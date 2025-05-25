#!/usr/bin/env bun
import { logger } from "$/shared";
import { ObsidianMcpServer } from "./features/core";
import { getVersion } from "./features/version" with { type: "macro" };

async function main() {
  try {
    // Environment variable check for OBSIDIAN_API_KEY removed.
    // Configuration is now handled by ObsidianMcpServer loading vaults.json.

    logger.debug("Starting MCP Tools for Obsidian server...");
    const server = new ObsidianMcpServer();
    await server.run();
    logger.debug("MCP Tools for Obsidian server is running");
  } catch (error) {
    logger.fatal("Failed to start server", {
      error: error instanceof Error ? error.message : String(error),
    });
    await logger.flush();
    throw error;
  }
}

if (process.argv.includes("--version")) {
  try {
    console.log(getVersion());
  } catch (error) {
    console.error(`Error getting version: ${error}`);
    process.exit(1);
  }
} else {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
