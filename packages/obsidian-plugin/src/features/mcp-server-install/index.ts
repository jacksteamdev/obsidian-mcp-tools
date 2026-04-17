import { Plugin } from "obsidian";
import type { SetupResult } from "./types";

export function setup(_plugin: Plugin): Promise<SetupResult> {
  try {
    return Promise.resolve({ success: true });
  } catch (error) {
    return Promise.resolve({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Re-export types and utilities that should be available to other features
export { default as FeatureSettings } from "./components/McpServerInstallSettings.svelte";
export * from "./constants";
export { updateClaudeConfig } from "./services/config";
export { installMcpServer } from "./services/install";
export { uninstallServer } from "./services/uninstall";
export * from "./types";
