import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { registerFetchTool } from "../fetch";
import { registerLocalRestApiTools } from "../local-rest-api";
import { setupObsidianPrompts } from "../prompts";
import { registerSmartConnectionsTools } from "../smart-connections";
import { registerTemplaterTools } from "../templates";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { IncomingMessage, ServerResponse } from "node:http";

export class ObsidianMcpServer {
  private server: Server;
  private tools: ToolRegistry;
  private transports: Map<string, SSEServerTransport>;

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
    this.transports = new Map();

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

  /**
   * Handles SSE connection requests (GET /sse)
   */
  async handleSSEConnection(req: IncomingMessage, res: ServerResponse) {
    logger.debug("New SSE connection request");

    const transport = new SSEServerTransport("/message", res);
    const sessionId = transport.sessionId;

    this.transports.set(sessionId, transport);

    transport.onclose = () => {
      logger.debug("SSE transport closed", { sessionId });
      this.transports.delete(sessionId);
    };

    transport.onerror = (error) => {
      logger.error("SSE transport error", { sessionId, error });
      this.transports.delete(sessionId);
    };

    try {
      await this.server.connect(transport);
      logger.debug("SSE connection established", { sessionId });
    } catch (err) {
      logger.error("Failed to establish SSE connection", {
        error: err instanceof Error ? err.message : String(err),
      });
      this.transports.delete(sessionId);
      throw err;
    }
  }

  /**
   * Handles POST message requests (/message)
   */
  async handlePostMessage(req: IncomingMessage, res: ServerResponse) {
    console.log("handlePostMessage");
    const sessionId = new URL(
      req.url || "",
      `http://${req.headers.host}`,
    ).searchParams.get("sessionId");

    if (!sessionId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing sessionId parameter" }));
      return;
    }

    const transport = this.transports.get(sessionId);
    if (!transport) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Session not found" }));
      return;
    }

    try {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      await new Promise<void>((resolve, reject) => {
        req.on("end", () => resolve());
        req.on("error", reject);
      });

      const parsedBody = JSON.parse(body);
      await transport.handlePostMessage(req, res, parsedBody);
    } catch (err) {
      logger.error("Failed to handle POST message", {
        error: err instanceof Error ? err.message : String(err),
        sessionId,
      });
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
}
