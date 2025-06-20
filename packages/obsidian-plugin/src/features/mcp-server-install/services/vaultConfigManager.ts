import type McpToolsPlugin from "../../../main"; // Adjusted path
import { logger } from "../../../shared/logger"; // Adjusted path
import fsp from "fs/promises";
import os from "os";
import path from "path";
// Define the types locally to avoid import issues
// These should match the types in packages/mcp-server/src/types/config.ts
interface VaultConfigEntry {
  vaultId: string;
  name: string;
  path?: string;
  localRestApiBaseUrl: string;
  apiKey: string;
}

interface ConfigFile {
  vaults: VaultConfigEntry[];
  defaultVaultId?: string;
}

// Path to the mcp-tools configuration directory and vaults.json file
// This should align with what configManager.ts on the server-side expects.
const MCP_TOOLS_CONFIG_DIR = path.join(os.homedir(), ".config", "mcp-tools");
const VAULTS_JSON_PATH = path.join(MCP_TOOLS_CONFIG_DIR, "vaults.json");

/**
 * Writes the vault configurations from plugin settings to the central vaults.json file.
 * This file is read by the MCP server to know about available vaults.
 * @param pluginInstance The instance of McpToolsPlugin containing settings.
 */
export async function writeInternalVaultsConfig(pluginInstance: McpToolsPlugin): Promise<void> {
  try {
    const vaultConfigsForPlugin = pluginInstance.settings.vaults || [];
    const defaultVaultId = pluginInstance.settings.defaultVaultId;

    // Transform VaultConfigForPlugin to VaultConfigEntry
    // This assumes VaultConfigForPlugin includes id, name, path, localRestApiBaseUrl, and apiKey
    const vaultEntries: VaultConfigEntry[] = vaultConfigsForPlugin.map(vc => ({
      vaultId: vc.id, // Map id to vaultId
      name: vc.name,
      path: vc.path,
      localRestApiBaseUrl: vc.localRestApiBaseUrl,
      apiKey: vc.apiKey, // Ensure apiKey is present in VaultConfigForPlugin
    }));

    // Create the config file structure
    const configFile: ConfigFile = {
      vaults: vaultEntries,
      defaultVaultId: defaultVaultId
    };

    // Ensure the .config/mcp-tools directory exists
    await fsp.mkdir(MCP_TOOLS_CONFIG_DIR, { recursive: true });

    // Write the config object to vaults.json
    await fsp.writeFile(VAULTS_JSON_PATH, JSON.stringify(configFile, null, 2));
    logger.info(`Successfully wrote vaults configuration to ${VAULTS_JSON_PATH}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to write internal vaults configuration to ${VAULTS_JSON_PATH}:`, { error: errorMessage });
    // Decide if this should throw or just log, potentially notify user.
    // For now, let's throw to make it visible during development.
    throw new Error(`Failed to write vaults.json: ${errorMessage}`);
  }
}

/**
 * Reads the vault configurations from the central vaults.json file.
 * @returns The vault configurations and default vault ID.
 */
export async function readInternalVaultsConfig(): Promise<{ vaults: VaultConfigEntry[], defaultVaultId?: string }> {
  try {
    // Check if the file exists
    try {
      await fsp.access(VAULTS_JSON_PATH);
    } catch (e) {
      // File doesn't exist, return empty config
      return { vaults: [] };
    }

    // Read and parse the file
    const fileContent = await fsp.readFile(VAULTS_JSON_PATH, 'utf-8');
    const jsonData = JSON.parse(fileContent);

    // Handle both new format (object with vaults array) and legacy format (just array)
    if (Array.isArray(jsonData)) {
      // Legacy format
      return { 
        vaults: jsonData.map(v => ({
          vaultId: v.vaultId || v.id, // Handle both vaultId and id for backward compatibility
          name: v.name,
          path: v.path,
          localRestApiBaseUrl: v.localRestApiBaseUrl,
          apiKey: v.apiKey
        }))
      };
    } else {
      // New format
      return {
        vaults: jsonData.vaults || [],
        defaultVaultId: jsonData.defaultVaultId
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to read internal vaults configuration from ${VAULTS_JSON_PATH}:`, { error: errorMessage });
    // Return empty config on error
    return { vaults: [] };
  }
}
