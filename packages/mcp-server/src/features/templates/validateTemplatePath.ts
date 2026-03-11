import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export function validateTemplatePath(path: string): void {
  if (path.includes("..")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Path traversal detected in template path: "${path}"`,
    );
  }
  if (path.includes("\0")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Null byte detected in template path`,
    );
  }
  if (path.startsWith("/")) {
    throw new McpError(
      ErrorCode.InvalidParams,
      `Absolute paths are not allowed in template path`,
    );
  }
}
