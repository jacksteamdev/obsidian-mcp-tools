#!/usr/bin/env bun
import { logger } from "$/shared";
import { ObsidianMcpServer } from "./features/core";
import { getVersion } from "./features/version" with { type: "macro" };

// Global Uncaught Exception and Unhandled Rejection Handlers
process.on('uncaughtException', async (error) => {
  logger.fatal('Uncaught exception detected, attempting graceful shutdown.', {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  await logger.flush();
  process.exit(1); // Exit with a failure code
});

process.on('unhandledRejection', async (reason, promise) => {
  logger.fatal('Unhandled promise rejection detected, attempting graceful shutdown.', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
    promise,
  });
  await logger.flush();
  process.exit(1); // Exit with a failure code
});

// Signal handlers for graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, initiating graceful shutdown.`);
  // Perform any necessary cleanup here before exiting
  await logger.flush(); // Ensure all logs are written
  process.exit(0); // Exit gracefully
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

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
