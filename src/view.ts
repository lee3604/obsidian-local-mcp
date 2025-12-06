import { ItemView, WorkspaceLeaf, requestUrl } from "obsidian";
import ObsidianMcpPlugin from "./main";

export const MCP_VIEW_TYPE = "mcp-server-dashboard";

export class McpServerView extends ItemView {
    plugin: ObsidianMcpPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: ObsidianMcpPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() {
        return MCP_VIEW_TYPE;
    }

    getDisplayText() {
        return "MCP Server Dashboard";
    }

    async onOpen() {
        this.render();
        // Register interval to update UI
        // this.registerInterval(window.setInterval(() => this.render(), 5000));
        return Promise.resolve();
    }

    async onClose() {
        // Nothing to cleanup
        return Promise.resolve();
    }

    render() {
        const container = this.containerEl.children[1];
        container.empty();

        container.createEl("h2", { text: "MCP Server Dashboard" });

        // --- Status Section ---
        const statusDiv = container.createEl("div", { cls: "mcp-status-container" });
        const isRunning = !!this.plugin.mcp;

        statusDiv.createEl("p", {
            text: isRunning ? "✅ Server is Running" : "🔴 Server is Stopped",
            cls: isRunning ? "mcp-running" : "mcp-stopped",
            attr: { style: `color: ${isRunning ? 'var(--text-success)' : 'var(--text-error)'}; font-weight: bold;` }
        });

        if (isRunning && this.plugin.mcp) {
            statusDiv.createEl("p", { text: `URL: ${this.plugin.mcp.url}` });
        }

        const controlDiv = container.createEl("div", { cls: "mcp-controls" });

        const toggleBtn = controlDiv.createEl("button", {
            text: isRunning ? "Stop Server" : "Start Server"
        });
        if (isRunning) toggleBtn.addClass("mod-warning");
        else toggleBtn.addClass("mod-cta");

        toggleBtn.addEventListener("click", () => {
            void (async () => {
                await this.plugin.toggleServer();
                this.render();
            })();
        });

        const refreshBtn = controlDiv.createEl("button", { text: "Refresh View" });
        refreshBtn.addEventListener("click", () => this.render());

        // --- Configuration Helper ---
        if (isRunning && this.plugin.mcp) {
            container.createEl("h3", { text: "Connection helper" });
            const helperDiv = container.createEl("div", { cls: "mcp-config-helper" });

            helperDiv.createEl("p", { text: "Add this configuration to your mcp.json file:" });

            const config = {
                "mcpServers": {
                    "obsidian": {
                        "url": this.plugin.mcp.url,
                        "type": "sse"
                    }
                }
            };
            const configStr = JSON.stringify(config, null, 2);

            const codeBlock = helperDiv.createEl("code", { cls: "mcp-code-block", text: configStr });

            const copyBtn = helperDiv.createEl("button", { text: "Copy Config to Clipboard" });
            copyBtn.addEventListener("click", () => {
                void (async () => {
                    await navigator.clipboard.writeText(configStr);
                    // @ts-ignore
                    new Notice("Configuration copied!");
                })();
            });
        }

        // --- Diagnostics ---
        container.createEl("h3", { text: "Diagnostics" });
        const diagDiv = container.createEl("div", { cls: "mcp-config-helper" }); // Reuse style

        const testBtn = diagDiv.createEl("button", { text: "Run self-test (check local connection)" });
        const resultArea = diagDiv.createEl("div", { cls: "mcp-test-result" });
        resultArea.hide();

        testBtn.addEventListener("click", () => {
            void (async () => {
                if (!this.plugin.mcp) {
                    // @ts-ignore
                    new Notice("Server is not running.");
                    return;
                }

                testBtn.disabled = true;
                testBtn.setText("Testing...");
                resultArea.hide();
                resultArea.removeClass("mcp-test-success", "mcp-test-error");

                try {
                    // Perform a simple POST list_resources request
                    // We bypass the SSE handshake to test core logic availability
                    const response = await requestUrl({
                        url: this.plugin.mcp.url,
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "Accept": "application/json"
                        },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            method: "resources/list",
                            id: 1,
                            params: {}
                        })
                    });

                    if (response.status === 200) {
                        const data = response.json;
                        if (data.result && data.result.resources) {
                            const count = data.result.resources.length;
                            resultArea.setText(`✅ Success! Found ${count} resources available.`);
                            resultArea.addClass("mcp-test-success");
                        } else {
                            resultArea.setText(`⚠️ Connected, but unexpected response format.`);
                            resultArea.addClass("mcp-test-error");
                        }
                    } else {
                        resultArea.setText(`❌ HTTP error: ${response.status}`);
                        resultArea.addClass("mcp-test-error");
                    }
                } catch (e) {
                    resultArea.setText(`❌ Connection failed: ${(e as Error).message}`);
                    resultArea.addClass("mcp-test-error");
                } finally {
                    resultArea.show();
                    testBtn.disabled = false;
                    testBtn.setText("Run self-test (check local connection)");
                }
            })();
        });
    }
}

