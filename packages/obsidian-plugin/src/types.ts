export interface McpToolsLocalRestApiSettings {
  host: string;
  useHttp: boolean;
  httpPort: number;
  httpsPort: number;
  baseUrl?: string;
}

export interface McpToolsPluginSettings {
  version?: string;
  localRestApi: McpToolsLocalRestApiSettings;
}

declare module "obsidian" {
  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
}
