import { Notice, Plugin, PluginSettingTab } from "obsidian";
import { BehaviorSubject, firstValueFrom, lastValueFrom } from "rxjs";
import { mount, unmount } from "svelte";

import { loadLocalRestAPI, logger, type Dependencies } from "$/shared";

import SettingsContainer from "./components/SettingsContainer.svelte";
import type { McpToolsPluginSettings } from "./types";

import { setup as setupMcpServerInstall } from "../mcp-server-install";
import { setup as setupSourceDocuments } from "../source-documents";
import { setup as setupTemplates } from "../templates";
import { setup as setupSmartSearch } from "../smart-search";

export class McpToolsSettingTab extends PluginSettingTab {
  plugin: McpToolsPlugin;
  component?: {
    $set?: unknown;
    $on?: unknown;
  };

  constructor(plugin: McpToolsPlugin) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    this.component = mount(SettingsContainer, {
      target: containerEl,
      props: { plugin: this.plugin },
    });
  }

  hide(): void {
    this.component && unmount(this.component);
  }
}

export class McpToolsPlugin extends Plugin {
  localRestApi$ = new BehaviorSubject<Dependencies["obsidian-local-rest-api"]>({
    id: "obsidian-local-rest-api",
    name: "Local REST API",
    required: true,
    installed: false,
  });

  onload() {
    logger.info("Loading MCP Tools Plugin");

    // Add settings tab to plugin
    this.addSettingTab(new McpToolsSettingTab(this));

    // Wait for required dependencies
    lastValueFrom(loadLocalRestAPI(this)).then(async (localRestApi) => {
      if (!localRestApi.api) {
        new Notice(
          `${this.manifest.name}: Local REST API plugin is required but not found. Please install it from the community plugins and restart Obsidian.`,
          0,
        );
        return;
      }

      this.localRestApi$.next(localRestApi);

      // Initialize features in order
      await setupMcpServerInstall(this);
      await setupSourceDocuments(this);
      await setupTemplates(this);
      await setupSmartSearch(this);

      logger.info("MCP Tools Plugin loaded");
    });
  }

  loadData(): Promise<McpToolsPluginSettings> {
    return super.loadData();
  }

  saveData(data: McpToolsPluginSettings): Promise<void> {
    return super.saveData(data);
  }

  async getLocalRestApiKey(): Promise<string | undefined> {
    const localRestApi = await firstValueFrom(this.localRestApi$);
    // The API key is stored in the plugin's settings
    return localRestApi.plugin?.settings?.apiKey;
  }

  onunload() {
    firstValueFrom(this.localRestApi$).then((localRestApi) => {
      localRestApi.api?.unregister();
    });
  }
}
