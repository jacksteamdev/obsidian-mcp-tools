import { mount, unmount } from "svelte";
import type { SetupResult } from "../mcp-server-install/types";
import SettingsTab from "./components/SettingsTab.svelte";

import { App, PluginSettingTab } from "obsidian";
import type AdvancedMCPServerPlugin from "../../main";

export class AdvancedMCPServerSettingsTab extends PluginSettingTab {
  plugin: AdvancedMCPServerPlugin;
  component?: {
    $set?: unknown;
    $on?: unknown;
  };

  constructor(app: App, plugin: AdvancedMCPServerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.component = mount(SettingsTab, {
      target: containerEl,
      props: { plugin: this.plugin },
    });
  }

  hide(): void {
    this.component && unmount(this.component);
  }
}

export async function setup(plugin: AdvancedMCPServerPlugin): Promise<SetupResult> {
  try {
    // Add settings tab to plugin
    plugin.addSettingTab(new AdvancedMCPServerSettingsTab(plugin.app, plugin));

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
