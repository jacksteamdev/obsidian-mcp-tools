import fsp from "fs/promises";
import { Plugin } from "obsidian";
import os from "os";
import path from "path";
import { logger } from "$/shared/logger";
import { CLAUDE_CONFIG_PATH } from "../constants";

interface ClaudeConfig {
  mcpServers: {
    [key: string]: {
      command: string;
      args?: string[];
      env?: {
        OBSIDIAN_API_KEY?: string;
        [key: string]: string | undefined;
      };
    };
  };
}

/**
 * Gets the absolute path to the Claude Desktop config file
 */
function getConfigPath(): string {
  const platform = os.platform();
  let configPath: string;

  switch (platform) {
    case "darwin":
      configPath = CLAUDE_CONFIG_PATH.macos;
      break;
    case "win32":
      configPath = CLAUDE_CONFIG_PATH.windows;
      break;
    default:
      configPath = CLAUDE_CONFIG_PATH.linux;
  }

  // Expand ~ to home directory if needed
  if (configPath.startsWith("~")) {
    configPath = path.join(os.homedir(), configPath.slice(1));
  }

  // Expand environment variables on Windows
  if (platform === "win32") {
    configPath = configPath.replace(/%([^%]+)%/g, (_, n) => process.env[n] || "");
  }

  return configPath;
}

/**
 * Updates the Claude Desktop config file with MCP server settings
 */
export async function updateClaudeConfig(
  plugin: Plugin, // plugin parameter is kept for now, though not directly used for apiKey
  serverPath: string
  // apiKey parameter removed
): Promise<void> {
  try {
    const configPath = getConfigPath();
    const configDir = path.dirname(configPath);

    // Ensure config directory exists
    await fsp.mkdir(configDir, { recursive: true });

    // Read existing config or create new one
    let config: ClaudeConfig = { mcpServers: {} };
    try {
      const content = await fsp.readFile(configPath, "utf8");
      config = JSON.parse(content);
      config.mcpServers = config.mcpServers || {};
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // File doesn't exist, use default empty config
    }

    // Update config with our server entry
    // OBSIDIAN_API_KEY is removed as the server will now use vaults.json
    config.mcpServers["obsidian-mcp-tools"] = {
      command: serverPath,
      env: {
        // No OBSIDIAN_API_KEY here
      },
    };

    // Write updated config
    await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
    logger.info("Updated Claude config", { configPath });
  } catch (error) {
    logger.error("Failed to update Claude config:", { error });
    throw new Error(
      `Failed to update Claude config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Removes the MCP server entry from the Claude Desktop config file
 */
export async function removeFromClaudeConfig(): Promise<void> {
  try {
    const configPath = getConfigPath();

    // Read existing config
    let config: ClaudeConfig;
    try {
      const content = await fsp.readFile(configPath, "utf8");
      config = JSON.parse(content);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        // File doesn't exist, nothing to remove
        return;
      }
      throw error;
    }

    // Remove our server entry if it exists
    if (config.mcpServers && "obsidian-mcp-tools" in config.mcpServers) {
      delete config.mcpServers["obsidian-mcp-tools"];
      await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
      logger.info("Removed server from Claude config", { configPath });
    }
  } catch (error) {
    logger.error("Failed to remove from Claude config:", { error });
    throw new Error(
      `Failed to remove from Claude config: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
