import {
  formatMcpError,
  LocalRestAPI,
  logger,
  makeRequest,
  SourceDocuments,
  type ToolRegistry,
} from "$/shared";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import type { SetupFunctionResult } from "shared";
import { DEFAULT_USER_AGENT } from "./constants";
import { convertHtmlToMarkdown } from "./services/markdown";
import { extractMetadata } from "./services/metadata";
import { createDocumentId } from "./utils/sanitize";

export async function setup(tools: ToolRegistry): SetupFunctionResult {
  try {
    // Register source_read tool
    tools.register(
      type({
        name: "'read_source'",
        arguments: SourceDocuments.readParams,
      }).describe("Read a source document incrementally"),
      async ({ arguments: args }) => {
        const page = args.page || 1;

        try {
          // Proxy request to plugin REST API
          const result = await makeRequest(
            LocalRestAPI.ApiPageResponse,
            `/sources/${args.documentId}?page=${page}`,
          );

          // Validate response
          const response = SourceDocuments.readResponse(result);
          if (response instanceof type.errors) {
            throw new McpError(
              ErrorCode.InternalError,
              `Invalid page response: ${response.summary}`,
            );
          }

          return {
            content: [
              {
                type: "text",
                text: response.content,
              },
              {
                type: "text",
                text: `Page ${response.pageNumber} of ${response.totalPages}`,
              },
            ],
          };
        } catch (error) {
          if (error instanceof McpError) {
            throw error;
          }
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to read source document: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      },
    );

    // Register create_source tool
    tools.register(
      type({
        name: "'create_source'",
        arguments: SourceDocuments.createParams,
      }).describe("Create a source document from a URL"),
      async ({ arguments: args }) => {
        try {
          // 1. Fetch source content
          const response = await fetch(args.url, {
            headers: { "User-Agent": DEFAULT_USER_AGENT },
          });
          if (!response.ok) {
            throw new McpError(
              ErrorCode.InternalError,
              `Failed to fetch ${args.url}: ${response.status} ${response.statusText}`,
            );
          }
          const html = await response.text();

          // 2. Process source content
          const metadata = extractMetadata(html, args.url);
          if (!metadata.title) {
            throw new McpError(
              ErrorCode.InternalError,
              "Could not determine document title",
            );
          }
          const documentId = createDocumentId(args.url, metadata.title);
          const markdown = convertHtmlToMarkdown(html, args.url);

          // 3. Create source document
          await makeRequest(
            LocalRestAPI.ApiResult,
            `/sources/${encodeURI(documentId)}`,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                content: markdown,
                metadata,
                update: args.update ?? false,
              }),
            },
          );

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ documentId }, null, 2),
              },
            ],
          };
        } catch (error) {
          logger.error("Source creation error:", {
            error: error instanceof Error ? error.message : error,
            url: args.url,
          });

          if (error instanceof McpError) {
            throw error;
          }

          throw new McpError(
            ErrorCode.InternalError,
            error instanceof Error ? error.message : String(error),
          );
        }
      },
    );

    // Register source_search tool
    tools.register(
      type({
        name: "'search_sources'",
        arguments: SourceDocuments.searchParams,
      }).describe("Semantic search for source documents"),
      async ({ arguments: args }) => {
        // Request search from plugin
        const results = await makeRequest(
          SourceDocuments.searchResult.array(),
          "/sources/search",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: args.query }),
          },
        );

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      },
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatMcpError(error).message,
    };
  }
}
