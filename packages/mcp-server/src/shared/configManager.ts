import { type } from "arktype";
import { homedir } from "node:os";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { logger } from "./logger";
import { 
  type VaultsConfig, 
  VaultsConfigSchema, 
  type ConfigFile, 
  ConfigFileSchema 
} from "../types/config";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

const CONFIG_DIR_PATH = join(homedir(), ".config", "mcp-tools");
const CONFIG_FILE_PATH = join(CONFIG_DIR_PATH, "vaults.json");

/**
 * Represents the configuration loaded from the config file
 */
export interface LoadedConfig {
  vaults: VaultsConfig;
  defaultVaultId?: string;
}

/**
 * Loads and validates the configuration from ~/.config/mcp-tools/vaults.json.
 * Supports both the new format (with vaults array and defaultVaultId) and
 * the legacy format (just an array of vault entries).
 *
 * @returns A promise that resolves with the validated configuration.
 *          Returns an empty config if the config file is not found (ENOENT).
 * @throws McpError if the file is invalid (parsing, validation, duplicates) or another read error occurs.
 */
export async function loadVaultsConfig(): Promise<LoadedConfig> {
  try {
    logger.debug(`Attempting to load vaults config from: ${CONFIG_FILE_PATH}`);
    const fileContent = await readFile(CONFIG_FILE_PATH, "utf-8");
    const jsonData = JSON.parse(fileContent);

    // Try to validate as new config format first
    const newFormatResult = ConfigFileSchema(jsonData);
    
    if (!(newFormatResult instanceof type.errors)) {
      // New format validation succeeded
      const configData = newFormatResult;
      
      // Check for duplicate vaultIds
      const vaultIds = new Set<string>();
      for (const vault of configData.vaults) {
        if (vaultIds.has(vault.vaultId)) {
          throw new McpError(
            ErrorCode.InternalError,
            `Duplicate vaultId "${vault.vaultId}" found in configuration file at ${CONFIG_FILE_PATH}. vaultId must be unique.`,
          );
        }
        vaultIds.add(vault.vaultId);
      }
      
      // Validate defaultVaultId if present
      if (configData.defaultVaultId && !vaultIds.has(configData.defaultVaultId)) {
        logger.warn(`Default vault ID "${configData.defaultVaultId}" does not match any configured vault. It will be ignored.`);
        // We don't throw an error, just ignore the invalid defaultVaultId
        configData.defaultVaultId = undefined;
      }

      logger.info(`Successfully loaded and validated vaults configuration from: ${CONFIG_FILE_PATH} (new format)`);
      return {
        vaults: configData.vaults,
        defaultVaultId: configData.defaultVaultId
      };
    }
    
    // Try legacy format (array of vault entries)
    const legacyFormatResult = VaultsConfigSchema(jsonData);
    
    if (legacyFormatResult instanceof type.errors) {
      // Both formats failed validation
      logger.error("Vaults configuration validation failed for both formats", {
        path: CONFIG_FILE_PATH,
        newFormatError: newFormatResult.summary,
        legacyFormatError: legacyFormatResult.summary,
      });
      throw new McpError(
        ErrorCode.InternalError,
        `Invalid vaults configuration file at ${CONFIG_FILE_PATH}: ${legacyFormatResult.summary}`,
      );
    }
    
    // Legacy format validation succeeded
    const vaultEntries = legacyFormatResult;
    
    // Check for duplicate vaultIds
    const vaultIds = new Set<string>();
    for (const vault of vaultEntries) {
      if (vaultIds.has(vault.vaultId)) {
        throw new McpError(
          ErrorCode.InternalError,
          `Duplicate vaultId "${vault.vaultId}" found in configuration file at ${CONFIG_FILE_PATH}. vaultId must be unique.`,
        );
      }
      vaultIds.add(vault.vaultId);
    }

    logger.info(`Successfully loaded and validated vaults configuration from: ${CONFIG_FILE_PATH} (legacy format)`);
    return {
      vaults: vaultEntries,
      defaultVaultId: undefined
    };

  } catch (error: any) {
    if (error.code === 'ENOENT') {
      logger.warn(`Vaults configuration file not found at ${CONFIG_FILE_PATH}. Server will start with no vaults configured.`);
      return { vaults: [] }; // Return empty config
    } else if (error instanceof McpError) {
      // Re-throw McpErrors (like validation or duplicate ID errors)
      throw error;
    } else if (error instanceof SyntaxError) {
      logger.error(`Failed to parse vaults configuration file at ${CONFIG_FILE_PATH}`, { error: error.message });
      throw new McpError(ErrorCode.InternalError, `Failed to parse vaults configuration file at ${CONFIG_FILE_PATH}: Invalid JSON.`);
    } else {
      logger.error(`Failed to load vaults configuration from ${CONFIG_FILE_PATH}`, { error: error.message });
      throw new McpError(ErrorCode.InternalError, `Failed to load vaults configuration from ${CONFIG_FILE_PATH}: ${error.message}`);
    }
  }
}
