import { createLogger } from "shared";

/**
 * The logger instance for the MCP server application.
 * This logger is configured with the "obsidian-mcp-tools" app name, writes to the "mcp-server.log" file,
 * and uses the "INFO" log level for all environments to reduce verbosity now that testing is complete.
 */
export const logger = createLogger({
  appName: "Claude",
  filename: "mcp-server-obsidian-mcp-tools.log",
  level: "DEBUG", // Increased logging level for debugging connection issues
});
