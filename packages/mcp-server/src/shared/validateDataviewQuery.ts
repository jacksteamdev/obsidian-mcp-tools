import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

const MAX_QUERY_LENGTH = 10_000;

/**
 * Validates a Dataview DQL query to prevent code execution via dataviewjs.
 * Rejects queries containing 'dataviewjs' and queries exceeding max length.
 */
export function validateDataviewQuery(query: string): void {
  if (query.length > MAX_QUERY_LENGTH) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Query is too long (${query.length} chars). Maximum allowed is ${MAX_QUERY_LENGTH}.`,
    );
  }

  if (/dataviewjs/i.test(query)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Dataviewjs queries are not allowed. Only DQL queries are permitted.",
    );
  }
}
