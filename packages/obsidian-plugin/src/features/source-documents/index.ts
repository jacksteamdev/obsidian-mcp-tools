import type { McpToolsPlugin } from "$/features/core";
import {
  documentMetadataSchema,
  loadTemplaterAPI,
  logger,
  processTemplate,
} from "$/shared";
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

    // Add REST API endpoint for document creation
    localRestApi.api
      .addRoute("/sources/:documentId")
      .put(async (req, res): Promise<void> => {
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
