import { App, PluginSettingTab, Setting, Notice } from "obsidian";
import ObsidianMcpPlugin from "./main";

export interface ObsidianMcpSettings {
    transport: "ws" | "sse";
    port: number;
    token: string;
    writeMode: "readonly" | "confirm-each" | "confirm-session" | "allowlist";
    allowPaths: string[];
    exposedFolders: string[];
    autostart: boolean;
}

export const DEFAULT_SETTINGS: ObsidianMcpSettings = {
    transport: "ws",
    port: 0,
    token: "",
    writeMode: "readonly",
    allowPaths: [],
    exposedFolders: [],
    autostart: true
};

export class ObsidianMcpSettingTab extends PluginSettingTab {
    plugin: ObsidianMcpPlugin;

    constructor(app: App, plugin: ObsidianMcpPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;

        containerEl.empty();

        new Setting(containerEl)
            .setName("Transport")
            .setDesc("Choose the transport protocol for the MCP server. WebSocket is recommended for bidirectional communication.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("ws", "WebSocket")
                    .addOption("sse", "SSE (Server-Sent Events)")
                    .setValue(this.plugin.settings.transport)
                    .onChange(async (value) => {
                        this.plugin.settings.transport = value as "ws" | "sse";
                        await this.plugin.saveSettings();
                        // TODO: Restart server
                    })
            );

        if (this.plugin.mcp) {
            new Setting(containerEl)
                .setName("Server URL")
                .setDesc("The address to connect your MCP client to.")
                .addText((text) =>
                    text
                        .setValue(this.plugin.mcp?.url || "")
                        .setDisabled(true)
                )
                .addButton(btn =>
                    btn
                        .setButtonText("Copy")
                        .onClick(async () => {
                            if (this.plugin.mcp?.url) {
                                await navigator.clipboard.writeText(this.plugin.mcp.url);
                                // @ts-ignore
                                new Notice("URL copied to clipboard");
                            }
                        })
                );
        }

        new Setting(containerEl)
            .setName("Port")
            .setDesc("Port to listen on. Set to 0 for random available port.")
            .addText((text) =>
                text
                    .setPlaceholder("0")
                    .setValue(String(this.plugin.settings.port))
                    .onChange(async (value) => {
                        const port = parseInt(value, 10);
                        if (!isNaN(port) && port >= 0) {
                            this.plugin.settings.port = port;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        new Setting(containerEl)
            .setName("Autostart")
            .setDesc("Automatically start the MCP server when Obsidian launches.")
            .addToggle((toggle) =>
                toggle
                    .setValue(this.plugin.settings.autostart)
                    .onChange(async (value) => {
                        this.plugin.settings.autostart = value;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Authentication token")
            .setDesc("Token for connecting to the MCP server. Keep this secret.")
            .addText((text) =>
                text
                    .setPlaceholder("Auto-generated")
                    .setValue(this.plugin.settings.token)
                    .setDisabled(true)
            )
            .addButton((btn) =>
                btn
                    .setButtonText("Regenerate")
                    .onClick(async () => {
                        this.plugin.settings.token = crypto.randomUUID().replace(/-/g, "");
                        await this.plugin.saveSettings();
                        this.display(); // refresh
                    })
            );

        new Setting(containerEl)
            .setName("Write mode")
            .setDesc("Control how write operations are handled.")
            .addDropdown((dropdown) =>
                dropdown
                    .addOption("readonly", "Read-only")
                    .addOption("confirm-each", "Confirm each write")
                    // .addOption("confirm-session", "Confirm per session (Coming Soon)")
                    // .addOption("allowlist", "Allow-list (Coming Soon)")
                    .setValue(this.plugin.settings.writeMode)
                    .onChange(async (value) => {
                        this.plugin.settings.writeMode = value as any;
                        await this.plugin.saveSettings();
                    })
            );

        new Setting(containerEl)
            .setName("Allowed folders (optional)")
            .setDesc("If set, only files within these folders will be exposed. Leave empty to allow all. Enter one folder path per line (e.g., 'Projects/Active').")
            .addTextArea((text) =>
                text
                    .setPlaceholder("Example:\nProjects\nNotes/Public")
                    .setValue(this.plugin.settings.exposedFolders.join("\n"))
                    .onChange(async (value) => {
                        this.plugin.settings.exposedFolders = value
                            .split("\n")
                            .map(p => p.trim())
                            .filter(p => p.length > 0);
                        await this.plugin.saveSettings();
                    })
            );
    }
}
