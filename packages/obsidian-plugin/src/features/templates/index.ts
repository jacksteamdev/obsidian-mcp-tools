import {
  loadTemplaterAPI,
  LocalRestAPI,
  logger,
  processTemplate,
  type SetupFunctionResult,
} from "$/shared";
import { type } from "arktype";
import type { Request, Response } from "express";
import { Notice, TFile } from "obsidian";
import { firstValueFrom, lastValueFrom } from "rxjs";
import type { McpToolsPlugin } from "../core";

export async function setup(plugin: McpToolsPlugin): SetupFunctionResult {
  try {
    const localRestApi = await firstValueFrom(plugin.localRestApi$);
    if (!localRestApi.api) {
      logger.error("Local REST API is not available", { localRestApi });
      return {
        success: false,
        error: "Local REST API is not available",
      };
    }

    localRestApi.api
      .addRoute("/templates/execute")
      .post(async (req: Request, res: Response) => {
        try {
          const { api: templater } = await lastValueFrom(
            loadTemplaterAPI(plugin),
          );
          if (!templater) {
            new Notice(
              `${plugin.manifest.name}: Templater plugin is not available. Please install it from the community plugins.`,
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
          const templateFile = plugin.app.vault.getAbstractFileByPath(
            params.name,
          );
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

          const processedContent = await processTemplate(
            templater,
            params,
            templateFile,
          );

          // Create new file if requested
          if (params.createFile && params.targetPath) {
            await plugin.app.vault.create(params.targetPath, processedContent);
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
      });

    return {
      success: true,
    };
  } catch (error) {
    logger.error("Error setting up templates feature:", {
      error: error instanceof Error ? error.message : error,
    });
    return {
      success: false,
      error: "Error setting up templates feature",
    };
  }
}
