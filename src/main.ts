import { App, Plugin, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { startMcpServer, stopMcpServer, McpHandle } from "./server";
import { ObsidianMcpSettings, DEFAULT_SETTINGS, ObsidianMcpSettingTab } from "./settings";
import { McpServerView, MCP_VIEW_TYPE } from "./view";

export default class ObsidianMcpPlugin extends Plugin {
    settings: ObsidianMcpSettings;
    mcp?: McpHandle;
    statusBarItem: HTMLElement | null = null;

    async onload() {
        await this.loadSettings();

        // Register View
        this.registerView(
            MCP_VIEW_TYPE,
            (leaf) => new McpServerView(leaf, this)
        );

        if (!this.settings.token) {
            this.settings.token = crypto.randomUUID().replace(/-/g, "");
            await this.saveSettings();
        }

        // Status Bar
        this.statusBarItem = this.addStatusBarItem();
        this.updateStatusBar();

        // Ribbon Icon -> Open Dashboard
        this.addRibbonIcon('server', 'Obsidian MCP Server', async () => {
            await this.activateView();
        });

        // Command: Restart Server
        this.addCommand({
            id: 'restart-mcp-server',
            name: 'Restart MCP Server',
            callback: async () => {
                await this.restartServer();
            }
        });

        // Command: Toggle Server
        this.addCommand({
            id: 'toggle-mcp-server',
            name: 'Toggle MCP Server',
            callback: async () => {
                await this.toggleServer();
            }
        });

        // Command: Open Dashboard
        this.addCommand({
            id: 'open-mcp-dashboard',
            name: 'Open Dashboard',
            callback: async () => {
                await this.activateView();
            }
        });

        // Settings Tab
        this.addSettingTab(new ObsidianMcpSettingTab(this.app, this));

        // Start Server if autostart is enabled
        if (this.settings.autostart) {
            await this.restartServer();
        }
    }

    onunload() {
        if (this.mcp) {
            stopMcpServer(this.mcp);
        }
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async toggleServer() {
        if (this.mcp) {
            await stopMcpServer(this.mcp);
            this.mcp = undefined;
            new Notice("MCP Server stopped");
        } else {
            try {
                this.mcp = await startMcpServer(this.app, this.settings, () => this.flashStatusBar());
                new Notice(`MCP Server started: ${this.mcp.url}`);
            } catch (e) {
                new Notice(`Failed to start MCP Server: ${e}`);
                console.error(e);
            }
        }
        this.updateStatusBar();
    }

    async restartServer() {
        if (this.mcp) {
            await stopMcpServer(this.mcp);
            this.mcp = undefined;
        }
        try {
            this.mcp = await startMcpServer(this.app, this.settings, () => this.flashStatusBar());
            new Notice(`MCP Server started: ${this.mcp.url}`);
        } catch (e) {
            new Notice(`Failed to start MCP Server: ${e}`);
            console.error(e);
        }
        this.updateStatusBar();
    }

    flashStatusBar() {
        if (!this.statusBarItem) return;
        this.statusBarItem.addClass("mcp-activity");
        // Remove class after animation
        setTimeout(() => {
            this.statusBarItem?.removeClass("mcp-activity");
        }, 1500);
    }

    updateStatusBar() {
        if (!this.statusBarItem) return;

        if (this.mcp) {
            this.statusBarItem.setText(`MCP: On`);
            this.statusBarItem.removeClass("mcp-status-off");
            this.statusBarItem.addClass("mcp-status-on");
            this.statusBarItem.setAttr("title", `MCP Server running at ${this.mcp.url}`);
        } else {
            this.statusBarItem.setText(`MCP: Off`);
            this.statusBarItem.removeClass("mcp-status-on");
            this.statusBarItem.addClass("mcp-status-off");
            this.statusBarItem.setAttr("title", "MCP Server is stopped");
        }
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(MCP_VIEW_TYPE);

        if (leaves.length > 0) {
            leaf = leaves[0];
        } else {
            leaf = workspace.getRightLeaf(false);
            if (leaf) {
                await leaf.setViewState({ type: MCP_VIEW_TYPE, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }
}
