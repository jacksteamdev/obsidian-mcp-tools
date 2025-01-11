import { type } from "arktype";
import type { Request, Response } from "express";
import { Notice, Plugin, PluginSettingTab, TFile } from "obsidian";
import { shake } from "radash";
import { lastValueFrom } from "rxjs";
import {
  jsonSearchRequest,
  LocalRestAPI,
  searchParameters,
  Templater,
  type PromptArgAccessor,
  type SearchResponse,
} from "shared";
import { mount, unmount } from "svelte";

import {
  loadLocalRestAPI,
  loadSmartSearchAPI,
  loadTemplaterAPI,
  logger,
  type Dependencies,
} from "$/shared";

import SettingsContainer from "./components/SettingsContainer.svelte";
import type { McpToolsPluginSettings } from "./types";

import { setup as setupMcpServerInstall } from "../mcp-server-install";
import { setup as setupSourceDocument } from "../source-document";

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
  private localRestApi: Dependencies["obsidian-local-rest-api"] = {
    id: "obsidian-local-rest-api",
    name: "Local REST API",
    required: true,
    installed: false,
  };

  async onload() {
    // Add settings tab to plugin
    this.addSettingTab(new McpToolsSettingTab(this));

    // Initialize features in order
    await setupMcpServerInstall(this);
    await setupSourceDocument(this);

    // Check for required dependencies
    lastValueFrom(loadLocalRestAPI(this)).then((localRestApi) => {
      this.localRestApi = localRestApi;

      if (!this.localRestApi.api) {
        new Notice(
          `${this.manifest.name}: Local REST API plugin is required but not found. Please install it from the community plugins and restart Obsidian.`,
          0,
        );
        return;
      }

      // Register endpoints
      this.localRestApi.api
        .addRoute("/search/smart")
        .post(this.handleSearchRequest.bind(this));

      this.localRestApi.api
        .addRoute("/templates/execute")
        .post(this.handleTemplateExecution.bind(this));

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
    // The API key is stored in the plugin's settings
    return this.localRestApi.plugin?.settings?.apiKey;
  }

  private async handleTemplateExecution(req: Request, res: Response) {
    try {
      const { api: templater } = await lastValueFrom(loadTemplaterAPI(this));
      if (!templater) {
        new Notice(
          `${this.manifest.name}: Templater plugin is not available. Please install it from the community plugins.`,
          0,
        );
        logger.error("Templater plugin is not available");
        res.status(503).json({
          error: "Templater plugin is not available",
        });
        return;
      }

      // Validate request body
      const params = LocalRestAPI.ApiTemplateExecutionParams(req.body);

      if (params instanceof type.errors) {
        const response = {
          error: "Invalid request body",
          body: req.body,
          summary: params.summary,
        };
        logger.debug("Invalid request body", response);
        res.status(400).json(response);
        return;
      }

      // Get prompt content from vault
      const templateFile = this.app.vault.getAbstractFileByPath(params.name);
      if (!(templateFile instanceof TFile)) {
        logger.debug("Template file not found", {
          params,
          templateFile,
        });
        res.status(404).json({
          error: `File not found: ${params.name}`,
        });
        return;
      }

      const config = templater.create_running_config(
        templateFile,
        templateFile,
        Templater.RunMode.CreateNewFromTemplate,
      );

      const prompt: PromptArgAccessor = (argName: string) => {
        return params.arguments[argName] ?? "";
      };

      const oldGenerateObject =
        templater.functions_generator.generate_object.bind(
          templater.functions_generator,
        );

      // Override generate_object to inject arg into user functions
      templater.functions_generator.generate_object = async function (
        config,
        functions_mode,
      ) {
        const functions = await oldGenerateObject(config, functions_mode);
        Object.assign(functions, { mcpTools: { prompt } });
        return functions;
      };

      // Process template with variables
      const processedContent = await templater.read_and_parse_template(config);

      // Restore original functions generator
      templater.functions_generator.generate_object = oldGenerateObject;

      // Create new file if requested
      if (params.createFile && params.targetPath) {
        await this.app.vault.create(params.targetPath, processedContent);
        res.json({
          message: "Prompt executed and file created successfully",
          content: processedContent,
        });
        return;
      }

      res.json({
        message: "Prompt executed without creating a file",
        content: processedContent,
      });
    } catch (error) {
      logger.error("Prompt execution error:", {
        error: error instanceof Error ? error.message : error,
        body: req.body,
      });
      res.status(503).json({
        error: "An error occurred while processing the prompt",
      });
      return;
    }
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
    this.localRestApi.api?.unregister();
  }
}
