declare module "obsidian" {
  // Interface for individual vault configuration stored in plugin settings
  interface VaultConfigForPlugin {
    id: string; // Unique identifier for the vault
    name: string; // User-friendly name for the vault
    path: string; // Absolute path to the vault
    localRestApiBaseUrl: string; // Base URL for the Local REST API of this vault
    apiKey: string; // API key for this vault's Local REST API
  }

  interface McpToolsPluginSettings {
    version?: string;
    vaults?: VaultConfigForPlugin[]; // Array to store configurations for multiple vaults
    defaultVaultId?: string; // Optional ID of the default vault to use when no vault is specified
  }

  interface Plugin {
    loadData(): Promise<McpToolsPluginSettings>;
    saveData(data: McpToolsPluginSettings): Promise<void>;
  }
}

export {};
