import { logger, type ToolRegistry } from "$/shared";
// Import ObsidianMcpServer to match the updated signature from core/index.ts
import type { ObsidianMcpServer } from "../core"; 
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { DEFAULT_USER_AGENT } from "./constants";
import { convertHtmlToMarkdown } from "./services/markdown";

// Signature updated to accept ObsidianMcpServer instance, though it's not used in this tool's current logic.
export function registerFetchTool(tools: ToolRegistry, obsServer: ObsidianMcpServer) { 
  tools.register(
    type({
      name: '"fetch"',
      arguments: {
        url: "string",
        "maxLength?": type("number").describe("Limit response length."),
        "startIndex?": type("number").describe(
          "Supports paginated retrieval of content.",
        ),
        "raw?": type("boolean").describe(
          "Returns raw HTML content if raw=true.",
        ),
      },
    }).describe(
      "Reads and returns the content of any web page. Returns the content in Markdown format by default, or can return raw HTML if raw=true parameter is set. Supports pagination through maxLength and startIndex parameters.",
    ),
    async ({ arguments: args }) => {
      logger.info("Fetching URL", { url: args.url });

      try {
        const response = await fetch(args.url, {
          headers: {
            "User-Agent": DEFAULT_USER_AGENT,
          },
        });

        if (!response.ok) {
          throw new McpError(
            ErrorCode.InternalError,
            `Failed to fetch ${args.url} - status code ${response.status}`,
          );
        }

        const contentType = response.headers.get("content-type") || "";
        const text = await response.text();

        const isHtml =
          text.toLowerCase().includes("<html") ||
          contentType.includes("text/html") ||
          !contentType;

        let content: string;
        let prefix = "";

        if (isHtml && !args.raw) {
          content = convertHtmlToMarkdown(text, args.url);
        } else {
          content = text;
          prefix = `Content type ${contentType} cannot be simplified to markdown, but here is the raw content:\n`;
        }

        const maxLength = args.maxLength || 5000;
        const startIndex = args.startIndex || 0;
        const totalLength = content.length;

        if (totalLength > maxLength) {
          content = content.substring(startIndex, startIndex + maxLength);
          content += `\n\n<error>Content truncated. Call the fetch tool with a startIndex of ${
            startIndex + maxLength
          } to get more content.</error>`;
        }

        logger.debug("URL fetched successfully", {
          url: args.url,
          contentLength: content.length,
        });

        return {
          content: [
            {
              type: "text",
              text: `${prefix}Contents of ${args.url}:\n${content}`,
            },
            {
              type: "text",
              text: `Pagination: ${JSON.stringify({
                totalLength,
                startIndex,
                endIndex: startIndex + content.length,
                hasMore: true,
              })}`,
            },
          ],
        };
      } catch (error) {
        logger.error("Failed to fetch URL", { url: args.url, error });
        throw new McpError(
          ErrorCode.InternalError,
          `Failed to fetch ${args.url}: ${error}`,
        );
      }
    },
  );
}
