import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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
        name: "obsidian-advanced",
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
