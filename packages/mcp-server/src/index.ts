#!/usr/bin/env bun
import { logger, createOAuthManagerFromEnv, type OAuthTokenManager } from "$/shared";
import { ObsidianMcpServer } from "./features/core";
import { getVersion } from "./features/version" with { type: "macro" };
import express from "express";
import cors from "cors";

async function main() {
  try {
    // Verify required environment variables - either API key OR OAuth credentials
    const API_KEY = process.env.OBSIDIAN_API_KEY;
    const oauthManager = createOAuthManagerFromEnv();

    if (!API_KEY && !oauthManager) {
      throw new Error(
        "Either OBSIDIAN_API_KEY or OAuth credentials (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_TOKEN_ENDPOINT) must be provided"
      );
    }

    const PORT = parseInt(process.env.PORT || "3000", 10);

    logger.debug("Starting MCP Tools for Obsidian HTTP server...");

    const app = express();
    const mcpServer = new ObsidianMcpServer();

    // Enable CORS for all routes
    app.use(cors());

    // Authentication middleware - supports both API key and OAuth token
    const authenticateApiKey: express.RequestHandler = async (req, res, next) => {
      // Check for API key in multiple locations
      const providedKey =
        req.headers.authorization?.replace(/^Bearer\s+/i, '') ||
        req.headers['x-api-key'] ||
        req.query.api_key;

      // If API key is configured, validate it
      if (API_KEY) {
        if (providedKey === API_KEY) {
          next();
          return;
        }
      }

      // If OAuth is configured, validate OAuth token
      if (oauthManager) {
        try {
          const validToken = await oauthManager.getToken();
          if (providedKey === validToken) {
            next();
            return;
          }
        } catch (error) {
          logger.error("OAuth token validation failed", { error });
        }
      }

      // If we get here, authentication failed
      logger.warn("Unauthorized request - invalid or missing credentials", {
        path: req.path,
        hasAuth: !!req.headers.authorization,
        hasApiKeyHeader: !!req.headers['x-api-key'],
        hasApiKeyQuery: !!req.query.api_key,
        hasApiKey: !!API_KEY,
        hasOAuth: !!oauthManager
      });
      res.status(401).json({ error: "Unauthorized - Invalid or missing credentials" });
    };

    // Health check endpoint (no authentication required)
    app.get("/health", (req, res) => {
      res.json({ status: "ok", version: getVersion() });
    });

    // SSE endpoint for establishing connections (protected)
    app.get("/sse", authenticateApiKey, async (req, res) => {
      try {
        await mcpServer.handleSSEConnection(req, res);
      } catch (error) {
        logger.error("SSE connection error", { error });
        if (!res.headersSent) {
          res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    // POST endpoint for receiving messages (protected)
    app.post("/message", authenticateApiKey, async (req, res) => {
      console.log("Message received", req.body);
      try {
        await mcpServer.handlePostMessage(req, res);
      } catch (error) {
        logger.error("Message handling error", { error });
        if (!res.headersSent) {
          res.status(500).json({
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    });

    app.listen(PORT, () => {
      logger.info(`MCP Tools for Obsidian HTTP server running on port ${PORT}`);
      console.log(`Server running at http://localhost:${PORT}`);
      console.log(`SSE endpoint: http://localhost:${PORT}/sse`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
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
