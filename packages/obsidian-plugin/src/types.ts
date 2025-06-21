import type { SmartConnections } from "shared";

declare module "obsidian" {
  interface McpToolsPluginSettings {
    version?: string;
  }

  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
  
  interface App {
    plugins: {
      plugins: {
        "smart-connections"?: {
          env?: SmartConnections.SmartSearch;
        } & Plugin;
      } & Record<string, Plugin>;
    };
  }
}

export {};
