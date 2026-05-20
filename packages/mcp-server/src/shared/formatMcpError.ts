import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";

export function formatMcpError(error: unknown) {
  if (error instanceof McpError) {
    return error;
  }

  if (error instanceof type.errors) {
    const message = error.summary;
    const hint = message.includes("must be")
      ? " HINT: Ensure all required parameters are included in the arguments object."
      : "";
    return new McpError(ErrorCode.InvalidParams, message + hint);
  }

  if (type({ message: "string" }).allows(error)) {
    return new McpError(ErrorCode.InternalError, error.message);
  }

  return new McpError(
    ErrorCode.InternalError,
    "An unexpected error occurred",
    error,
  );
}
