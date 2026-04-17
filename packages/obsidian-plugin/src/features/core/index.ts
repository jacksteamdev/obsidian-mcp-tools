import { mount, unmount } from "svelte";
import type { SetupResult } from "../mcp-server-install/types";
import SettingsTab from "./components/SettingsTab.svelte";

import { App, PluginSettingTab } from "obsidian";
import type McpToolsPlugin from "../../main";

export class McpToolsSettingTab extends PluginSettingTab {
  plugin: McpToolsPlugin;
  component?: {
    $set?: unknown;
    $on?: unknown;
  };

  constructor(app: App, plugin: McpToolsPlugin) {
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
    if (this.component) {
      void unmount(this.component);
    }
  }
}

export function setup(plugin: McpToolsPlugin): Promise<SetupResult> {
  try {
    plugin.addSettingTab(new McpToolsSettingTab(plugin.app, plugin));
    return Promise.resolve({ success: true });
  } catch (error) {
    return Promise.resolve({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
