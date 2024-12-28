#!/usr/bin/env bun
import { logger } from "./logger.js";
import { ObsidianServer } from "./server.js";

async function main() {
  try {
    // Verify required environment variables
    const API_KEY = process.env.OBSIDIAN_API_KEY;
    if (!API_KEY) {
      throw new Error("OBSIDIAN_API_KEY environment variable is required");
    }

    logger.debug("Starting Obsidian MCP server...");
    const server = new ObsidianServer();
    await server.run();
    logger.debug("Obsidian MCP server is running");
  } catch (error) {
    logger.fatal("Failed to start server", {
      error: error instanceof Error ? error.message : String(error),
    });
    await logger.flush();
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});