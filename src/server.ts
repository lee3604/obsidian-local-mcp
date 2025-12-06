import { App, TFile, TAbstractFile } from "obsidian";
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import http from "http";
import express from "express";
import { z } from "zod";
import { ObsidianMcpSettings } from "./settings";
import { ConfirmationModal } from "./modals";

// Helper to check for TFile in both runtime and test environments
function isTFile(file: TAbstractFile | null): file is TFile {
    if (!file) return false;
    // Runtime check
    if (file instanceof TFile) return true;
    // Test mock check (duck typing)
    const fileObj = file as unknown as { extension?: string; stat?: unknown };
    return fileObj.extension !== undefined && fileObj.stat !== undefined;
}

function isPathAllowed(path: string, allowedFolders: string[]): boolean {
    if (allowedFolders.length === 0) return true;
    return allowedFolders.some(folder => path.startsWith(folder));
}

export interface McpHandle {
    url: string;
    stop: () => Promise<void>;
}

export async function startMcpServer(app: App, settings: ObsidianMcpSettings, onActivity?: () => void): Promise<McpHandle> {
    const server = new McpServer({
        name: "obsidian-mcp",
        version: "1.0.0",
    });

    // --- Resources ---
    // R-2. ResourceTemplate 사용: obsidian://note/{path} 패턴 등록
    server.registerResource(
        "vault-note",
        new ResourceTemplate("obsidian://note/{path}", { list: undefined }),
        {
            mimeType: "text/markdown",
            description: "Markdown note in your Obsidian vault"
        },
        async (uri, { path }) => {
            onActivity?.();

            if (typeof path !== 'string') {
                throw new Error("Invalid path parameter");
            }

            // Decode path just in case, though Obsidian paths usually don't need complex decoding
            const decodedPath = decodeURIComponent(path);

            if (!isPathAllowed(decodedPath, settings.exposedFolders)) {
                throw new Error(`Access denied: path '${decodedPath}' is not in the allowed folders list.`);
            }

            const file = app.vault.getAbstractFileByPath(decodedPath);
            if (!isTFile(file)) {
                throw new Error(`Resource not found: ${decodedPath}`);
            }

            const content = await app.vault.read(file);

            return {
                contents: [{
                    uri: uri.href,
                    mimeType: "text/markdown",
                    text: content,
                }],
            };
        }
    );

    // --- Tools ---
    // R-3. search_notes 툴
    server.registerTool(
        "search_notes",
        {
            description: "Search for notes in the Obsidian vault.",
            inputSchema: z.object({
                query: z.string().min(1, "Query cannot be empty"),
            }),
        },
        async ({ query }) => {
            onActivity?.();

            const lower = query.toLowerCase();
            const files = app.vault.getMarkdownFiles();
            const results: string[] = [];

            for (const file of files) {
                if (!isPathAllowed(file.path, settings.exposedFolders)) continue;
                if (file.path.toLowerCase().includes(lower)) {
                    results.push(file.path);
                }
            }

            return {
                content: [
                    { type: "text", text: JSON.stringify(results.slice(0, 50)) },
                ],
            };
        }
    );

    // R-4. write_note 툴
    server.registerTool(
        "write_note",
        {
            description: "Write or overwrite a note. REQUIRES APPROVAL.",
            inputSchema: z.object({
                path: z.string().min(1, "Path is required"),
                content: z.string(),
            }),
        },
        async ({ path, content }) => {
            onActivity?.();

            if (!isPathAllowed(path, settings.exposedFolders)) {
                throw new Error(`Access denied: Path '${path}' is not in the allowed folders list.`);
            }

            if (settings.writeMode === "readonly") {
                throw new Error("Write permission denied (read-only mode).");
            }

            if (settings.writeMode === "confirm-each") {
                const approved = await new Promise<boolean>((resolve) => {
                    const modal = new ConfirmationModal(
                        app,
                        "Allow write?",
                        `Tool: write_note\nPath: ${path}`,
                        () => resolve(true),
                        () => resolve(false)
                    );
                    modal.open();
                });

                if (!approved) {
                    throw new Error("Write operation denied by user.");
                }
            }

            let file = app.vault.getAbstractFileByPath(path);
            if (file) {
                if (isTFile(file)) {
                    await app.vault.modify(file, content);
                    return {
                        content: [{ type: "text", text: `File '${path}' updated.` }]
                    };
                }
                throw new Error(`Path '${path}' exists but is not a file.`);
            } else {
                await app.vault.create(path, content);
                return {
                    content: [{ type: "text", text: `File '${path}' created.` }]
                };
            }
        }
    );

    // R-4. append_note 툴
    server.registerTool(
        "append_note",
        {
            description: "Append content to a note. REQUIRES APPROVAL.",
            inputSchema: z.object({
                path: z.string().min(1, "Path is required"),
                content: z.string(),
            }),
        },
        async ({ path, content }) => {
            onActivity?.();

            if (!isPathAllowed(path, settings.exposedFolders)) {
                throw new Error(`Access denied: Path '${path}' is not in the allowed folders list.`);
            }

            if (settings.writeMode === "readonly") {
                throw new Error("Write permission denied (read-only mode).");
            }

            if (settings.writeMode === "confirm-each") {
                const approved = await new Promise<boolean>((resolve) => {
                    const modal = new ConfirmationModal(
                        app,
                        "Allow append?",
                        `Tool: append_note\nPath: ${path}`,
                        () => resolve(true),
                        () => resolve(false)
                    );
                    modal.open();
                });

                if (!approved) {
                    throw new Error("Append operation denied by user.");
                }
            }

            const file = app.vault.getAbstractFileByPath(path);
            if (isTFile(file)) {
                const existingContent = await app.vault.read(file);
                await app.vault.modify(file, existingContent + content);
                return {
                    content: [{ type: "text", text: `Content appended to '${path}'.` }]
                };
            }

            throw new Error(`File not found: ${path}`);
        }
    );

    // R-5. HTTP Transport 유지
    const expressApp = express();
    // Express requires body parsing for JSON
    expressApp.use(express.json());

    // StreamableHTTPServerTransport now takes an options object
    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    // Route all traffic to the transport
    // The transport handles routing internally (GET for SSE, POST for messages) based on request method
    expressApp.all("/*", async (req, res) => {
        await transport.handleRequest(req, res);
    });

    await server.connect(transport);

    const httpServer = http.createServer(expressApp);
    const port = settings.port || 0;
    await new Promise<void>((resolve) => httpServer.listen(port, "127.0.0.1", resolve));

    const addr = httpServer.address();
    const url = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : port}`;
    console.log(`MCP server listening on ${url}`);

    return {
        url,
        stop: async () => {
            await server.close();
            await new Promise<void>((resolve, reject) => {
                httpServer.close((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    };
}

export async function stopMcpServer(handle: McpHandle): Promise<void> {
    await handle.stop();
}
