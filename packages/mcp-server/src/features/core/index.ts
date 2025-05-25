import { logger, type ToolRegistry, ToolRegistryClass } from "$/shared";
import { loadVaultsConfig, type LoadedConfig } from "$/shared/configManager"; // Import the new config loader and type
import { type VaultConfigEntry } from "$/types/config"; // Import VaultConfigEntry type
import { Server } from "@modelcontextprotocol/sdk/server/index.js"; // Removed 'type Tool' import
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype"; // Added ArkType
import { registerFetchTool } from "../fetch";
import { registerLocalRestApiTools } from "../local-rest-api";
import { setupObsidianPrompts } from "../prompts";
import { registerSmartConnectionsTools } from "../smart-connections";
import { registerTemplaterTools } from "../templates";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type Result, // Import Result
} from "@modelcontextprotocol/sdk/types.js";

// Define types for the list_configured_vaults tool handler return value
type ListVaultsToolResultContent = ({ type: "text", text: string } | { type: "image", data: string, mimeType: string })[];
type ListVaultsToolReturnValue = { content: ListVaultsToolResultContent, isError?: boolean };

// Define schema for the list_configured_vaults tool output
const VaultInfoSchema = type({
  vaultId: "string",
  name: "string",
});
const ListConfiguredVaultsOutputSchema = VaultInfoSchema.array();

// Define the schema for the list_configured_vaults tool itself
export const ListConfiguredVaultsToolSchema = type({
  name: "'list_configured_vaults'", // Tool name is part of the schema
  "arguments?": type({}).as<Record<string, unknown>>() // Optional empty record with correct type
}).describe("Lists all configured Obsidian vaults with their ID and name."); // Use .describe() for description

export class ObsidianMcpServer {
  private server: Server;
  private tools: ToolRegistry;
  private vaultsConfig: VaultConfigEntry[] = []; // Store loaded vault configurations
  private defaultVaultId?: string; // Store the default vault ID

  constructor() {
    logger.debug("ObsidianMcpServer: Constructor called.");
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

    // Error handling
    this.server.onerror = (error) => {
      logger.error("ObsidianMcpServer: Server error occurred.", { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        code: (error instanceof McpError) ? error.code : undefined,
      });
      console.error("[MCP Tools Error]", error);
    };
    process.on("SIGINT", async () => {
      logger.debug("ObsidianMcpServer: SIGINT received, closing server.");
      await this.server.close();
      logger.debug("ObsidianMcpServer: Server closed, exiting process.");
      process.exit(0);
    });
    logger.debug("ObsidianMcpServer: Constructor finished.");
  }

  private async initializeConfig() {
    logger.debug("ObsidianMcpServer: Initializing configuration...");
    try {
      const config = await loadVaultsConfig();
      this.vaultsConfig = config.vaults;
      this.defaultVaultId = config.defaultVaultId;
      
      if (this.vaultsConfig.length === 0) {
        logger.warn("ObsidianMcpServer: No vaults configured. Server will run but may not be able to perform vault-specific operations.");
      } else {
        logger.info(`ObsidianMcpServer: Loaded configuration for ${this.vaultsConfig.length} vault(s).`);
        if (this.defaultVaultId) {
          logger.info(`ObsidianMcpServer: Default vault ID set to: ${this.defaultVaultId}`);
        }
      }
      logger.debug("ObsidianMcpServer: Configuration initialization finished.");
    } catch (error) {
      logger.fatal("ObsidianMcpServer: Failed to load vaults configuration during server startup.", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Depending on desired behavior, we might want to exit if config is critical and fails to load.
      // For now, log fatal and continue, server might be unusable for vault operations.
      // Consider throwing the error to halt server startup if config is absolutely essential.
    }
  }

  /**
   * Gets the configuration for a vault by its ID.
   * If no vaultId is provided, it will:
   * 1. Use the configured default vault ID if available
   * 2. Fall back to the first available vault if no default is set
   * 3. Throw an error if no vaults are configured
   * 
   * @param vaultId Optional vault ID to look up
   * @returns The vault configuration entry
   * @throws McpError if the vault is not found or no vaults are configured
   */
  public getVaultConfig(vaultId?: string): VaultConfigEntry {
    logger.debug(`ObsidianMcpServer: Attempting to get vault config for ID: "${vaultId || 'default/first available'}"`);
    // Case 1: Specific vault ID provided
    if (vaultId) {
      const vault = this.vaultsConfig.find(v => v.vaultId === vaultId);
      if (vault) {
        logger.debug(`ObsidianMcpServer: Found vault config for ID: "${vaultId}"`);
        return vault;
      }
      
      logger.error(`ObsidianMcpServer: Vault config not found for ID: "${vaultId}"`);
      throw new McpError(
        ErrorCode.InvalidRequest, 
        `Configuration for vaultId "${vaultId}" not found or server not configured for this vault.`
      );
    }
    
    // Case 2: Use configured default vault
    if (this.defaultVaultId) {
      const defaultVault = this.vaultsConfig.find(v => v.vaultId === this.defaultVaultId);
      if (defaultVault) {
        logger.debug(`ObsidianMcpServer: Using default vault: ${this.defaultVaultId}`);
        return defaultVault;
      }
      logger.warn(`ObsidianMcpServer: Default vault ID "${this.defaultVaultId}" is configured but not found in vaults list. Falling back to first available.`);
    }
    
    // Case 3: Use first available vault
    if (this.vaultsConfig.length > 0) {
      logger.debug(`ObsidianMcpServer: No vault ID provided or default not found, using first available vault: ${this.vaultsConfig[0].vaultId}`);
      return this.vaultsConfig[0];
    }
    
    // Case 4: No vaults available
    logger.error("ObsidianMcpServer: No vaults configured. Cannot get vault config.");
    throw new McpError(
      ErrorCode.InvalidRequest, 
      "No vaults configured. Please configure at least one vault."
    );
  }

  public getVaultsConfig(): Readonly<VaultConfigEntry[]> { // Public getter for all vault configs
    logger.debug("ObsidianMcpServer: getVaultsConfig called.");
    return this.vaultsConfig;
  }

  // Handler for the list_configured_vaults tool
  private async listConfiguredVaultsHandler(
    _request: typeof ListConfiguredVaultsToolSchema.infer,
    _context: { server: Server }
  ): Promise<ListVaultsToolReturnValue> {
    logger.debug("ObsidianMcpServer: list_configured_vaults tool handler called.");
    const vaultsConfig = this.getVaultsConfig();
    const dataToReturn = vaultsConfig
      ? vaultsConfig.map(v => ({ vaultId: v.vaultId, name: v.name })) 
      : [];
    
    logger.debug("ObsidianMcpServer: list_configured_vaults tool returning data.", { 
      vaultCount: vaultsConfig.length,
      data: dataToReturn
    });
    
    return {
      content: [{ type: "text", text: JSON.stringify(dataToReturn) }]
    };
  }

  private setupHandlers() {
    logger.debug("ObsidianMcpServer: Setting up handlers and registering tools...");
    // Pass 'this' (ObsidianMcpServer instance) to all feature setup/registration functions
    // to provide access to vault configurations via getVaultConfig.
    setupObsidianPrompts(this.server, this); // Pass ObsidianMcpServer instance
    registerFetchTool(this.tools, this); // Pass ObsidianMcpServer instance
    registerLocalRestApiTools(this.tools, this); // Already correct
    registerSmartConnectionsTools(this.tools, this); // Pass ObsidianMcpServer instance
    registerTemplaterTools(this.tools, this); // Pass ObsidianMcpServer instance

    // Register the list_configured_vaults tool
    logger.debug("ObsidianMcpServer: Registering list_configured_vaults tool.");
    this.tools.register(
      ListConfiguredVaultsToolSchema, 
      this.listConfiguredVaultsHandler.bind(this)
    );

    logger.debug("ObsidianMcpServer: Setting request handler for ListToolsRequestSchema.");
    this.server.setRequestHandler(ListToolsRequestSchema, this.tools.list);
    
    logger.debug("ObsidianMcpServer: Setting request handler for CallToolRequestSchema.");
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      logger.debug("ObsidianMcpServer: Handling CallToolRequest.", { 
        toolName: request.params.name, 
        toolArguments: request.params.arguments 
      });
      // The dispatcher will need to be vault-aware or tools themselves will be.
      // For now, this part remains, but tools.dispatch or individual tools
      // will need to extract vaultId from request.params.arguments.
      try {
        const response = await this.tools.dispatch(request.params, {
          server: this.server, // The core MCP server instance
          // obsidianServer: this, // Removed: this context is passed via .bind() to the tool handler
        });
        logger.debug("ObsidianMcpServer: CallToolRequest handled successfully.", { 
          toolName: request.params.name, 
          response: response 
        });
        return response;
      } catch (dispatchError) {
        logger.error("ObsidianMcpServer: Error dispatching tool.", {
          toolName: request.params.name,
          error: dispatchError instanceof Error ? dispatchError.message : String(dispatchError),
          stack: dispatchError instanceof Error ? dispatchError.stack : undefined,
        });
        // Re-throw or return an error response as appropriate for MCP protocol
        throw dispatchError; 
      }
    });
    logger.debug("ObsidianMcpServer: Handlers setup finished.");
  }

  async run() {
    logger.debug("ObsidianMcpServer: Starting server run process...");
    logger.debug("ObsidianMcpServer: Initializing server configuration...");
    await this.initializeConfig(); // Load config before connecting
    
    logger.debug("ObsidianMcpServer: Setting up handlers and registering tools...");
    this.setupHandlers(); // Setup handlers after config is loaded
    
    // Log the list of registered tools for debugging
    const toolsList = this.tools.list();
    logger.debug("ObsidianMcpServer: Registered tools summary.", { 
      toolCount: toolsList.tools.length,
      tools: toolsList.tools.map(t => t.name)
    });

    logger.debug("ObsidianMcpServer: Starting server transport connection...");
    const transport = new StdioServerTransport();
    try {
      await this.server.connect(transport);
      logger.debug("ObsidianMcpServer: Server started successfully and connected to transport.");
    } catch (err) {
      logger.fatal("ObsidianMcpServer: Failed to start server or connect to transport.", {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      process.exit(1);
    }
    logger.debug("ObsidianMcpServer: Server run process finished.");
  }
}
