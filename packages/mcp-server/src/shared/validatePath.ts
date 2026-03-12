import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Validates a vault-relative path to prevent path traversal attacks.
 * Rejects paths containing '..', absolute paths, and null bytes.
 * Returns the path unchanged if valid.
 */
export function validateVaultPath(path: string): string {
  if (path.includes("\0")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Path must not contain null bytes.",
    );
  }

  if (path.startsWith("/")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Absolute paths are not allowed.",
    );
  }

  if (path.split("/").some((segment) => segment === "..")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Paths containing path traversal sequences ('..') are not allowed.",
    );
  }

  return path;
}
