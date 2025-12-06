import fs from "fs";
// Note: using vitest syntax if available, otherwise just simple assert. 
// I'll use simple node:assert for minimal dependency if vitest not installed.
// But I can try to install vitest or just use a simple runner script.
// Let's use `node:test` (available in Node 20+, my env is Node 25).
import test from "node:test";
import assert from "node:assert";
import { startMcpServer } from "../src/server"; // Direct import? server.ts uses 'obsidian' import.
// Problem: 'obsidian' module is not resolvable in Node.
// Solution: Mock 'obsidian' module via require.cache or just don't import server.ts directly?
// server.ts imports 'obsidian'. I need to map it to mocks.

// We can use a test runner that supports module mapping, or just a simple hack.

import { App } from "obsidian";

// Wait, I need to install client SDK or use installed SDK.
// I have @modelcontextprotocol/sdk installed.

test("MCP Server Tests", async (t) => {
    // Mock Obsidian App
    const appMock = {
        vault: {
            getFiles: () => [
                { path: "notes/hello.md", basename: "hello", extension: "md", stat: { mtime: Date.now() } },
                { path: "notes/todo.md", basename: "todo", extension: "md", stat: { mtime: Date.now() } }
            ],
            getMarkdownFiles: () => [
                { path: "notes/hello.md", basename: "hello", extension: "md", stat: { mtime: Date.now() } },
                { path: "notes/todo.md", basename: "todo", extension: "md", stat: { mtime: Date.now() } }
            ],
            getAbstractFileByPath: (path: string) => {
                if (path === "notes/hello.md") return { path: "notes/hello.md", basename: "hello", extension: "md", stat: { mtime: Date.now() } };
                return null;
            },
            read: async (file: any) => {
                if (file.path === "notes/hello.md") return "Hello World";
                return "";
            }
        },
        metadataCache: {
            getFileCache: () => ({ frontmatter: {} })
        }
    };

    // Mock Settings
    const settings = {
        transport: "sse",
        port: 0,
        token: "test-token",
        writeMode: "confirm-each",
        allowPaths: []
    };

    // Start Server
    // @ts-ignore
    const handle = await startMcpServer(appMock as App, settings);
    console.log("Server started at", handle.url);

    let msgId = 1;
    const rpcRequest = async (method: string, params?: any) => {
        const id = msgId++;
        const response = await fetch(handle.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream" // Required by transport
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                id,
                method,
                params
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.error(`RPC failed: ${response.status} ${text}`);
            throw new Error(`RPC failed: ${response.status} ${text}`);
        }

        const data = await response.json();
        console.log("RPC Response Data:", JSON.stringify(data));
        if (data.error) {
            throw new Error(`RPC Error: ${JSON.stringify(data.error)}`);
        }
        return data.result;
    };

    // Test Initialization
    await t.test("Initialize", async () => {
        const result = await rpcRequest("initialize", {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "1.0" }
        });
        assert.ok(result);
        assert.ok(result.serverInfo);

        // Send initialized notification
        await fetch(handle.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream"
            },
            body: JSON.stringify({
                jsonrpc: "2.0",
                method: "notifications/initialized"
            })
        });
    });

    // Test List Resources
    await t.test("List Resources", async () => {
        const result = await rpcRequest("resources/list");
        console.log("ListResources result:", JSON.stringify(result));
        assert.strictEqual(result.resources.length, 2);
        assert.strictEqual(result.resources[0].uri, "obsidian://note/notes/hello.md");
    });

    // Test Read Resource
    await t.test("Read Resource", async () => {
        const result = await rpcRequest("resources/read", { uri: "obsidian://note/notes/hello.md" });
        console.log("ReadResource result:", JSON.stringify(result));
        assert.strictEqual(result.contents[0].text, "Hello World");
    });

    // Test Search Tool (Call Tool)
    await t.test("Search Notes", async () => {
        const result = await rpcRequest("tools/call", {
            name: "search_notes",
            arguments: { query: "todo" }
        });
        console.log("SearchTool result:", JSON.stringify(result));
        // @ts-ignore
        const content = result.content[0];
        if (content.type === "text") {
            const files = JSON.parse(content.text);
            assert.ok(files.includes("notes/todo.md"));
        } else {
            assert.fail("Unexpected content type");
        }
    });

    // Cleanup
    await handle.stop();
});
