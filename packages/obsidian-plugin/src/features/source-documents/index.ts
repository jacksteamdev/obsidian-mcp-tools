import type { McpToolsPlugin } from "$/features/core";
import {
  documentMetadataSchema,
  loadTemplaterAPI,
  logger,
  pageResponseSchema,
  processTemplate,
  readSourceSchema,
} from "$/shared";
import { extractPage } from "./services/pagination";
import type { SetupFunctionResult } from "$/shared";
import { type } from "arktype";
import { TFile } from "obsidian";
import { firstValueFrom, lastValueFrom } from "rxjs";
import { SettingsManager } from "./services/settings";

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
    const route = localRestApi.api.addRoute("/sources/:documentId");

    // GET endpoint for reading documents
    route.get(async (req, res) => {
      const { documentId } = req.params;
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
      const { documentId } = req.params;
      const { body, metadata } = req.body;

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

        const templateFile = plugin.app.vault.getAbstractFileByPath(
          settings.templatePath,
        );
        if (!(templateFile instanceof TFile)) {
          res.status(404).json({
            error: `Template not found: ${settings.templatePath}`,
          });
          return;
        }

        // 3. Process template
        const targetPath = `${settings.sourcesDirectory}/${documentId}.md`;
        const targetFile = await plugin.app.vault.create(targetPath, "");
        const processedContent = await processTemplate(
          templateFile,
          targetFile,
          {
            name: documentId,
            arguments: { ...metadataResult, body },
            createFile: true,
            targetPath,
          },
          templater,
        );

        // Create new file
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
