import {
  loadSmartSearchAPI,
  logger,
  searchParameters,
  searchRequest,
} from "$/shared";
import { type } from "arktype";
import type { Request, Response } from "express";
import { Notice } from "obsidian";
import { shake } from "radash";
import { firstValueFrom, lastValueFrom } from "rxjs";
import type { SearchResponse, SetupFunctionResult } from "shared";
import type { McpToolsPlugin } from "../core";

export function handleSearchRequest(plugin: McpToolsPlugin) {
  return async (req: Request, res: Response) => {
    try {
      const dep = await lastValueFrom(loadSmartSearchAPI(plugin));
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
      const requestBody = searchRequest
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
  };
}

export async function setup(plugin: McpToolsPlugin): SetupFunctionResult {
  try {
    // Check if local REST API plugin is available
    const localRestApi = await firstValueFrom(plugin.localRestApi$);
    if (!localRestApi?.api) {
      return {
        success: false,
        error: "Local REST API plugin is not available",
      };
    }

    // Register endpoints
    localRestApi.api
      .addRoute("/search/smart")
      .post(handleSearchRequest(plugin));

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
