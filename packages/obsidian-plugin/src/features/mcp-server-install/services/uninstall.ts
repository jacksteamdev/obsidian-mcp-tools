import { logger } from "$/shared/logger";
import fsp from "fs/promises";
import { Plugin } from "obsidian";
import path from "path";
import { BINARY_NAME } from "../constants";
import { getPlatform } from "./install";

/**
 * Uninstalls the MCP server by removing the binary and cleaning up configuration
 */
export async function uninstallServer(plugin: Plugin): Promise<void> {
  try {
    // Remove binary
    const platform = getPlatform();
    const binDir = path.join(
      plugin.app.vault.adapter.basePath,
      plugin.app.vault.configDir,
      "plugins",
      plugin.manifest.id,
      "bin"
    );
    const binaryPath = path.join(binDir, BINARY_NAME[platform]);

    try {
      await fsp.unlink(binaryPath);
      logger.info("Removed server binary", { binaryPath });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // File doesn't exist, continue
    }

    // Remove bin directory if empty
    try {
      await fsp.rmdir(binDir);
      logger.info("Removed empty bin directory", { binDir });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") {
        throw error;
      }
      // Directory not empty, leave it
    }

    // Remove our entry from Claude config
    // Note: We don't remove the entire config file since it may contain other server configs
    const configPath = path.join(
      process.env.HOME || process.env.USERPROFILE || "",
      "Library/Application Support/Claude/claude_desktop_config.json"
    );

    try {
      const content = await fsp.readFile(configPath, "utf8");
      const config = JSON.parse(content);

      if (config.mcpServers && config.mcpServers["obsidian-advanced"]) {
        delete config.mcpServers["obsidian-advanced"];
        await fsp.writeFile(configPath, JSON.stringify(config, null, 2));
        logger.info("Removed server from Claude config", { configPath });
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Config doesn't exist, nothing to clean up
    }

    logger.info("Server uninstall complete");
  } catch (error) {
    logger.error("Failed to uninstall server:", { error });
    throw new Error(
      `Failed to uninstall server: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
