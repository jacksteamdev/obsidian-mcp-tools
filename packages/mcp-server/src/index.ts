#!/usr/bin/env bun
import { logger } from "$/shared";
import { ObsidianMcpServer } from "./features/core";
import { getVersion } from "./features/version" with { type: "macro" };

async function main() {
  try {
    // Verify required environment variables
    const API_KEY = process.env.OBSIDIAN_API_KEY;
    if (!API_KEY) {
      throw new Error("OBSIDIAN_API_KEY environment variable is required");
    }

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
    process.stdout.write(`${getVersion()}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error getting version: ${message}`);
    process.exit(1);
  }
} else {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
