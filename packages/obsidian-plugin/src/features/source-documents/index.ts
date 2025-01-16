import type { McpToolsPlugin } from "$/features/core";
import {
  documentMetadataSchema,
  loadSmartSearchAPI,
  loadTemplaterAPI,
  logger,
  pageResponseSchema,
  processTemplate,
  readSourceSchema,
} from "$/shared";
import { extractPage } from "./services/pagination";
import { searchDocuments } from "./services/search";
import type { SetupFunctionResult } from "$/shared";
import { type } from "arktype";
import { TFile } from "obsidian";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { SettingsManager } from "./services/settings";
import { createFileWithPath } from "./utils/vault";

export { default as Settings } from "./components/Settings.svelte";
export * from "./constants";
export * from "./types";

export async function setup(plugin: McpToolsPlugin): SetupFunctionResult {
  try {
    // Initialize settings
    const settingsManager = new SettingsManager(plugin);
    const settings = await settingsManager.loadSettings();

    // Check if local REST API plugin is available
    const localRestApi = await firstValueFrom(plugin.localRestApi$);
    if (!localRestApi?.api) {
      return {
        success: false,
        error: "Local REST API plugin is not available",
      };
    }

    // Add REST API endpoints for source documents
    const searchRoute = localRestApi.api.addRoute("/sources/search");
    const route = localRestApi.api.addRoute("/sources/:origin/:id");

    // POST endpoint for searching documents
    searchRoute.post(async (req, res) => {
      const { query } = req.body;

      try {
        // Validate query
        if (!query?.trim()) {
          res.status(400).json({
            error: "Query is required",
          });
          return;
        }

        // Try loading Smart Connections API
        const { api: smartSearch } = await lastValueFrom(
          loadSmartSearchAPI(plugin),
        );

        // Search documents
        const results = await searchDocuments(
          plugin.app,
          query,
          settings.sourcesDirectory,
          smartSearch,
        );

        res.json(results);
      } catch (error) {
        logger.error("Search error:", {
          error: error instanceof Error ? error.message : error,
          query,
        });
        res.status(503).json({
          error: "Search failed",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    // GET endpoint for reading documents
    route.get(async (req, res) => {
      const { id, origin } = req.params;
      const documentId = `${origin}/${id}`;
      const page = Number(req.query.page) || 1;

      const params = readSourceSchema({ documentId, page });
      if (params instanceof type.errors) {
        res.status(400).json({
          error: "Invalid request parameters",
          details: params.summary,
        });
        return;
      }

      try {
        // Get document
        const file = plugin.app.vault.getAbstractFileByPath(
          `${settings.sourcesDirectory}/${documentId}.md`,
        );

        if (!file || !(file instanceof TFile)) {
          res.status(404).json({
            error: "Document not found",
          });
          return;
        }

        // Read content
        const content = await plugin.app.vault.read(file);

        // Extract page using pagination service
        const { pageContent, pageNumber, totalPages } = await extractPage(
          content,
          page,
          settings.maxPageSize,
        );

        // Validate response
        const response = pageResponseSchema({
          content: pageContent,
          pageNumber,
          totalPages,
        });
        if (response instanceof type.errors) {
          throw new Error(`Invalid page response: ${response.summary}`);
        }

        res.json(response);
        return;
      } catch (error) {
        logger.error("Document read error:", {
          error: error instanceof Error ? error.message : error,
          documentId,
          page,
        });
        res.status(503).json({
          error: "Failed to read document",
          details: error instanceof Error ? error.message : String(error),
        });
        return;
      }
    });

    // PUT endpoint for document creation
    route.put(async (req, res): Promise<void> => {
      const { origin, id } = req.params;
      const documentId = `${origin}/${id}`;
      const { content, metadata } = req.body;

      try {
        // 1. Validate metadata
        const metadataResult = documentMetadataSchema(metadata);
        if (metadataResult instanceof type.errors) {
          res.status(400).json({
            error: "Invalid metadata",
            details: metadataResult.summary,
          });
          return;
        }

        // 2. Get templater
        const { api: templater } = await lastValueFrom(
          loadTemplaterAPI(plugin),
        );
        if (!templater) {
          res.status(503).json({
            error: "Templater plugin is not available",
          });
          return;
        }

        // 3. Get template file
        const templateFile = plugin.app.vault.getAbstractFileByPath(
          settings.templatePath,
        );
        if (!(templateFile instanceof TFile)) {
          res.status(404).json({
            error: `Template not found: ${settings.templatePath}`,
          });
          return;
        }

        // 4. Get target file
        const targetPath = `${settings.sourcesDirectory}/${documentId}.md`;
        const targetFile = await createFileWithPath(
          plugin.app.vault,
          targetPath,
          "", // Stub content prior to processing
        );

        // 5. Process template
        const processedContent = await processTemplate(
          templateFile,
          targetFile,
          {
            name: documentId,
            arguments: { ...metadataResult, content },
            createFile: true,
            targetPath,
          },
          templater,
        );

        // 6. Update target file with processed content
        await plugin.app.vault.modify(targetFile, processedContent);

        res.json({
          message: "Source document created successfully",
          content: processedContent,
        });
      } catch (error) {
        logger.error("Document creation error:", {
          error: error instanceof Error ? error.message : error,
          documentId,
        });
        res.status(503).json({
          error: "Failed to create document",
          details: error instanceof Error ? error.message : String(error),
        });
      }
    });

    return { success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    logger.error("Failed to setup source document feature:", {
      error: message,
    });
    return {
      success: false,
      error: message,
    };
  }
}
