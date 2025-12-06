import { App, TFile, TAbstractFile } from "obsidian";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    ListResourcesRequestSchema,
    ReadResourceRequestSchema,
    ListToolsRequestSchema,
    CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import http from "http";
import express from "express";
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
    const server = new Server({
        name: "obsidian-mcp",
        version: "1.0.0",
    }, {
        capabilities: {
            resources: {},
            tools: {},
            prompts: {},
            logging: {},
        }
    });

    // --- Resources ---
    server.setRequestHandler(
        ListResourcesRequestSchema,
        async () => {
            onActivity?.();
            const files = app.vault.getMarkdownFiles();
            const allowedFiles = files.filter(f => isPathAllowed(f.path, settings.exposedFolders));

            return {
                resources: allowedFiles.map((f: TFile) => ({
                    uri: `obsidian://note/${f.path}`,
                    name: f.basename,
                    mimeType: "text/markdown",
                    description: `File: ${f.path}`
                }))
            };
        }
    );

    server.setRequestHandler(
        ReadResourceRequestSchema,
        async (request) => {
            onActivity?.();
            const uri = request.params.uri;
            if (typeof uri === 'string' && uri.startsWith("obsidian://note/")) {
                const path = uri.replace("obsidian://note/", "");

                if (!isPathAllowed(path, settings.exposedFolders)) {
                    throw new Error(`Access Denied: Path '${path}' is not in the allowed folders list.`);
                }

                const file = app.vault.getAbstractFileByPath(path);
                if (isTFile(file)) {
                    const content = await app.vault.read(file);
                    return {
                        contents: [{
                            uri: uri,
                            mimeType: "text/markdown",
                            text: content
                        }]
                    };
                }
            }
            throw new Error(`Resource not found: ${uri}`);
        }
    );

    // --- Tools ---
    server.setRequestHandler(
        ListToolsRequestSchema,
        async () => {
            // Activity on tool listing is maybe too noisy? Let's include it for now.
            // onActivity?.(); 
            return {
                tools: [
                    {
                        name: "search_notes",
                        description: "Search for notes in the Obsidian vault.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: { type: "string" },
                            },
                            required: ["query"]
                        }
                    },
                    {
                        name: "write_note",
                        description: "Write or overwrite a note. REQUIRES APPROVAL.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                content: { type: "string" },
                            },
                            required: ["path", "content"]
                        }
                    },
                    {
                        name: "append_note",
                        description: "Append content to a note. REQUIRES APPROVAL.",
                        inputSchema: {
                            type: "object",
                            properties: {
                                path: { type: "string" },
                                content: { type: "string" },
                            },
                            required: ["path", "content"]
                        }
                    }
                ]
            };
        }
    );

    server.setRequestHandler(
        CallToolRequestSchema,
        async (request) => {
            onActivity?.(); // Activity on tool call
            const name = request.params.name;
            const args = request.params.arguments || {};

            if (name === "search_notes") {
                const query = String(args.query).toLowerCase();
                const files = app.vault.getMarkdownFiles();
                const results = [];

                for (const file of files) {
                    if (!isPathAllowed(file.path, settings.exposedFolders)) continue;

                    if (file.path.toLowerCase().includes(query)) {
                        results.push(file.path);
                        continue;
                    }
                }

                return {
                    content: [{ type: "text", text: JSON.stringify(results.slice(0, 50)) }]
                };
            }

            if (name === "write_note" || name === "append_note") {
                const path = String(args.path);

                if (!isPathAllowed(path, settings.exposedFolders)) {
                    throw new Error(`Access Denied: Path '${path}' is not in the allowed folders list.`);
                }

                if (settings.writeMode === "readonly") {
                    throw new Error("Write permission denied (Read-only mode).");
                }

                const content = String(args.content);

                // Confirm
                if (settings.writeMode === "confirm-each") {
                    const approved = await new Promise<boolean>((resolve) => {
                        try {
                            const modal = new ConfirmationModal(
                                app,
                                "Allow Write?",
                                `Tool: ${name}\nPath: ${path}`,
                                () => resolve(true),
                                () => resolve(false)
                            );
                            // @ts-ignore
                            modal.open();
                        } catch (e) {
                            console.error("Failed to open modal", e);
                            resolve(false);
                        }
                    });

                    if (!approved) {
                        throw new Error("User rejected write operation.");
                    }
                }

                if (name === "write_note") {
                    let file = app.vault.getAbstractFileByPath(path);
                    if (!file) {
                        file = await app.vault.create(path, content);
                    } else if (isTFile(file)) {
                        await app.vault.modify(file, content);
                    } else {
                        throw new Error(`Path exists but is not a file: ${path}`);
                    }
                    return { content: [{ type: "text", text: `Wrote to ${path}` }] };
                }

                if (name === "append_note") {
                    const file = app.vault.getAbstractFileByPath(path);
                    if (isTFile(file)) {
                        await app.vault.append(file, content);
                        return { content: [{ type: "text", text: `Appended to ${path}` }] };
                    }
                    throw new Error(`File not found or not a valid file: ${path}`);
                }
            }

            throw new Error(`Tool not found: ${name}`);
        }
    );

    // --- Transport Setup ---
    const appExpress = express();
    const port = settings.port > 0 ? settings.port : 0; // 0 let OS pick

    const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true
    });

    await server.connect(transport);

    appExpress.all("/mcp", async (req, res) => {
        await transport.handleRequest(req, res);
    });

    let netServer: http.Server;

    return new Promise((resolve) => {
        netServer = appExpress.listen(port, "127.0.0.1", () => {
            const address = netServer.address();
            const actualPort = typeof address === 'string' ? 0 : address?.port;
            const url = `http://127.0.0.1:${actualPort}/mcp`;
            resolve({
                url,
                stop: async () => {
                    await server.close();
                    netServer.close();
                }
            });
        });
    });
}

export async function stopMcpServer(handle: McpHandle) {
    if (handle) {
        await handle.stop();
    }
}
