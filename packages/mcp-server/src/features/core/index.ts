import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerCommandsTools } from "../commands";
import { registerFetchTool } from "../fetch";
import { registerLocalRestApiTools } from "../local-rest-api";
import { setupObsidianPrompts } from "../prompts";
import { registerSmartConnectionsTools } from "../smart-connections";
import { registerTemplaterTools } from "../templates";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

export class ObsidianMcpServer {
  private server: Server;
  private tools: ToolRegistry;

  constructor() {
    this.server = new Server(
      {
        name: "obsidian-mcp-tools",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          prompts: {},
        },
      },
    );

    this.tools = new ToolRegistryClass();

    this.setupHandlers();

    // Error handling
    this.server.onerror = (error) => {
      logger.error("Server error", { error });
      console.error("[MCP Tools Error]", error);
    };
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    setupObsidianPrompts(this.server);

    registerFetchTool(this.tools, this.server);
    registerLocalRestApiTools(this.tools, this.server);
    registerSmartConnectionsTools(this.tools);
    registerTemplaterTools(this.tools);
    registerCommandsTools(this.tools);

    this.applyDisabledToolsFromEnv();

    this.server.setRequestHandler(ListToolsRequestSchema, this.tools.list);
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.debug("Handling request", { request });
      const response = await this.tools.dispatch(request.params, {
        server: this.server,
      });
      logger.debug("Request handled", { response });
      return response;
    });
  }

  /**
   * Parse the OBSIDIAN_DISABLED_TOOLS env var and disable each listed
   * tool by name. Format: comma-separated tool names, whitespace around
   * names is trimmed, empty entries are skipped.
   *
   *   OBSIDIAN_DISABLED_TOOLS="patch_vault_file, delete_vault_file"
   *
   * Unknown tool names are logged as warnings but do not abort startup
   * — they may refer to tools from a different server version, and we
   * prefer a server that runs with 17/18 tools over one that refuses
   * to start because of a typo in the user's config.
   */
  private applyDisabledToolsFromEnv() {
    const raw = process.env.OBSIDIAN_DISABLED_TOOLS;
    if (!raw) return;

    const names = raw
      .split(",")
      .map((n) => n.trim())
      .filter((n) => n.length > 0);

    for (const name of names) {
      const disabled = this.tools.disableByName(name);
      if (disabled) {
        logger.info("Disabled tool via OBSIDIAN_DISABLED_TOOLS", { tool: name });
      } else {
        logger.warn("OBSIDIAN_DISABLED_TOOLS references unknown tool", {
          tool: name,
        });
      }
    }
  }

  async run() {
    logger.debug("Starting server...");
    const transport = new StdioServerTransport();
    try {
      await this.server.connect(transport);
      logger.debug("Server started successfully");
    } catch (err) {
      logger.fatal("Failed to start server", {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }
}
