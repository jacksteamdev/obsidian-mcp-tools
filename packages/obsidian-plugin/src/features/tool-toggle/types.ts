/**
 * Settings augmentation for the tool-toggle feature. Lives here (not in
 * the root plugin types.ts) so the feature stays self-contained per the
 * .clinerules feature architecture rule.
 */
declare module "obsidian" {
  interface McpToolsPluginSettings {
    toolToggle?: {
      /**
       * List of MCP tool names the user has chosen to disable. Persisted
       * by `plugin.saveData()` and forwarded to the server binary as the
       * `OBSIDIAN_DISABLED_TOOLS` env var at install time.
       */
      disabled?: string[];
    };
  }
}

export {};
