import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerFetchTool as setupFetch } from "../fetch";
import { setup as setupLocalRestApi } from "../local-rest-api";
import { setup as setupPrompts } from "../prompts";
import { setup as setupSmartSearch } from "../smart-search";
import { setup as setupTemplates } from "../templates";
import { setup as setupSourceDocuments } from "../source-documents";
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
    setupPrompts(this.server);

    setupFetch(this.tools, this.server);
    setupLocalRestApi(this.tools, this.server);
    setupSmartSearch(this.tools);
    setupTemplates(this.tools);
    setupSourceDocuments(this.tools);

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
