import { type } from "arktype";
import type { Request, Response } from "express";
import { Notice, Plugin, PluginSettingTab } from "obsidian";
import { shake } from "radash";
import { BehaviorSubject, firstValueFrom, lastValueFrom } from "rxjs";
import {
  jsonSearchRequest,
  searchParameters,
  type SearchResponse,
} from "shared";
import { mount, unmount } from "svelte";

import {
  loadLocalRestAPI,
  loadSmartSearchAPI,
  logger,
  type Dependencies,
} from "$/shared";

import SettingsContainer from "./components/SettingsContainer.svelte";
import type { McpToolsPluginSettings } from "./types";

import { setup as setupMcpServerInstall } from "../mcp-server-install";
import { setup as setupSourceDocuments } from "../source-documents";
import { setup as setupTemplates } from "../templates";

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

  async onload() {
    logger.info("Loading MCP Tools Plugin");

    // Add settings tab to plugin
    this.addSettingTab(new McpToolsSettingTab(this));

    // Check for required dependencies
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

      // Register endpoints
      localRestApi.api
        .addRoute("/search/smart")
        .post(this.handleSearchRequest.bind(this));

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

  private async handleSearchRequest(req: Request, res: Response) {
    try {
      const dep = await lastValueFrom(loadSmartSearchAPI(this));
      const smartSearch = dep.api;
      if (!smartSearch) {
        new Notice(
          "Smart Search REST API Plugin: smart-connections plugin is required but not found. Please install it from the community plugins.",
          0,
        );
        res.status(503).json({
          error: "Smart Connections plugin is not available",
        });
        return;
      }

      // Validate request body
      const requestBody = jsonSearchRequest
        .pipe(({ query, filter = {} }) => ({
          query,
          filter: shake({
            key_starts_with_any: filter.folders,
            exclude_key_starts_with_any: filter.excludeFolders,
            limit: filter.limit,
          }),
        }))
        .to(searchParameters)(req.body);
      if (requestBody instanceof type.errors) {
        res.status(400).json({
          error: "Invalid request body",
          summary: requestBody.summary,
        });
        return;
      }

      // Perform search
      const results = await smartSearch.search(
        requestBody.query,
        requestBody.filter,
      );

      // Format response
      const response: SearchResponse = {
        results: await Promise.all(
          results.map(async (result) => ({
            path: result.item.path,
            text: await result.item.read(),
            score: result.score,
            breadcrumbs: result.item.breadcrumbs,
          })),
        ),
      };

      res.json(response);
      return;
    } catch (error) {
      logger.error("Smart Search API error:", { error, body: req.body });
      res.status(503).json({
        error: "An error occurred while processing the search request",
      });
      return;
    }
  }

  onunload() {
    firstValueFrom(this.localRestApi$).then((localRestApi) => {
      localRestApi.api?.unregister();
    });
  }
}
