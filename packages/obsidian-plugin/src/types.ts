import type { Platform, Arch } from "./features/mcp-server-install/constants";

declare module "obsidian" {
  interface McpToolsPluginSettings {
    version?: string;
    /** Custom platform override (useful for WSL scenarios) */
    customPlatform?: Platform;
    /** Custom architecture override */
    customArch?: Arch;
    /** Custom binary path (overrides default installation path) */
    customBinaryPath?: string;
    /** Custom command to run the server (e.g., wsl.exe wrapper) */
    customCommand?: string;
    /** Environment variables to pass to the server */
    customEnvVars?: Record<string, string>;
    /** Custom host for server connection */
    customHost?: string;
  }

  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
}

export {};
