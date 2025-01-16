import { LocalRestAPI, makeRequest } from "$/shared";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import type { DocumentMetadata } from "../types";
import { documentIdSchema } from "../utils/sanitize";

/**
 * Creates a new document in the vault using the provided content and metadata.
 *
 * @param documentId - The ID/filename for the new document
 * @param content - The Markdown content for the document
 * @param metadata - The document metadata
 * @returns The created document information
 * @throws {McpError} If document creation fails
 */
export async function createDocument(
  documentId: string,
  content: string,
  metadata: DocumentMetadata,
) {
  // Validate document ID
  if (!documentIdSchema.allows(documentId)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Invalid document ID: ${documentId}`,
    );
  }

  try {
    // Create document via plugin's REST API
    const result = await makeRequest(
      LocalRestAPI.ApiNoContentResponse,
      "/sources/" + encodeURIComponent(documentId),
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: content,
          metadata,
        }),
      },
    );

    return result;
  } catch (error) {
    // Convert plugin errors to MCP errors
    if (error instanceof McpError) {
      throw error;
    }

    throw new McpError(
      ErrorCode.InternalError,
      error instanceof Error ? error.message : String(error),
    );
  }
}
