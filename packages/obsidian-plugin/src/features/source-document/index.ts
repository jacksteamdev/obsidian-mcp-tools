import type McpToolsPlugin from "../../main";
import { SettingsManager } from "./services/settings";

export { default as Settings } from "./components/Settings.svelte";
export * from "./constants";
export * from "./types";

export async function setup(plugin: McpToolsPlugin): Promise<{ success: true } | { success: false; error: string }> {
  try {
    // Initialize settings
    const settingsManager = new SettingsManager(plugin);
    const settings = await settingsManager.loadSettings();

    // Create sources directory if enabled
    if (settings.enabled) {
      await settingsManager.ensureSourcesDirectory();
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to setup source document feature:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}
