import { Plugin } from "obsidian";
import type { SetupResult } from "./types";

export async function setup(plugin: Plugin): Promise<SetupResult> {
  try {
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Re-export types and utilities that should be available to other features
export { default as Settings } from "./components/Settings.svelte";
export * from "./constants";
export { updateClaudeConfig } from "./services/config";
export { installMcpServer } from "./services/install";
export { uninstallServer } from "./services/uninstall";
export * from "./types";
