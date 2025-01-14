import {
  formatMcpError,
  LocalRestAPI,
  logger,
  makeRequest,
  pageResponseSchema,
  readSourceSchema,
  type ToolRegistry,
} from "$/shared";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import type { SetupFunctionResult } from "shared";
import { createDocument } from "./services/document";
import { convertHtmlToMarkdown, extractMetadata } from "./services/markdown";
import { createSourceSchema } from "./types";
import { sanitizeTitle } from "./utils/sanitize";

const DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; McpTools/1.0)";

export async function setup(tools: ToolRegistry): SetupFunctionResult {
  try {
    // Register source_read tool
    tools.register(
      type({ name: "'read_source'", arguments: readSourceSchema }),
      async ({ arguments: args }) => {
        const page = args.page || 1;

        try {
          // Proxy request to plugin REST API
          const result = await makeRequest(
            LocalRestAPI.ApiPageResponse,
            `/sources/${args.documentId}?page=${page}`,
          );

          // Validate response
          const response = pageResponseSchema(result);
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
    tools.register(createSourceSchema, async ({ arguments: args }) => {
      try {
        // 1. Fetch content
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

        // 2. Extract metadata
        const metadata = extractMetadata(html, args.url);
        if (!metadata.title) {
          throw new McpError(
            ErrorCode.InternalError,
            "Could not determine document title",
          );
        }

        // 3. Generate document ID
        const documentId = sanitizeTitle(metadata.title);
        if (!documentId) {
          throw new McpError(
            ErrorCode.InternalError,
            "Could not generate valid document ID from title",
          );
        }

        // 4. Convert to markdown
        const markdown = convertHtmlToMarkdown(html, args.url);

        // 5. Create document
        const result = await createDocument(documentId, markdown, metadata);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
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
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: formatMcpError(error).message,
    };
  }
}
