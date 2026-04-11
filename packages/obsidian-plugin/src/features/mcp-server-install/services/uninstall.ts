import { logger } from "$/shared/logger";
import fsp from "fs/promises";
import { Plugin } from "obsidian";
import path from "path";
import { BINARY_NAME } from "../constants";
import { getFileSystemAdapter } from "../utils/getFileSystemAdapter";
import { getConfigPath } from "./config";
import { getPlatform } from "./install";

/**
 * Uninstalls the MCP server by removing the binary and cleaning up configuration
 */
export async function uninstallServer(plugin: Plugin): Promise<void> {
  try {
    const adapter = getFileSystemAdapter(plugin);
    if ("error" in adapter) {
      throw new Error(adapter.error);
    }

    // Remove binary
    const platform = getPlatform();
    const binDir = path.join(
      adapter.getBasePath(),
      plugin.app.vault.configDir,
      "plugins",
      plugin.manifest.id,
      "bin",
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

    // Remove bin directory if empty. Tolerate both ENOTEMPTY (user
    // dropped sidecar files in the dir) and ENOENT (the bin dir was
    // never created, i.e. uninstall is being called on a vault that
    // never ran "Install Server" — a legitimate no-op path that the
    // settings UI relies on to reset state after a failed install).
    try {
      await fsp.rmdir(binDir);
      logger.info("Removed empty bin directory", { binDir });
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "ENOENT") {
        throw error;
      }
      // Directory not empty or never existed — nothing to do.
    }

    // Remove our entry from Claude config, reusing the same
    // platform-aware path resolution as updateClaudeConfig. This
    // replaces a previously hardcoded macOS-only path that left
    // orphan entries on Linux and Windows after uninstall.
    // Note: we don't remove the entire config file since it may
    // contain entries for other MCP servers.
    const configPath = getConfigPath();

    try {
      const content = await fsp.readFile(configPath, "utf8");
      const config = JSON.parse(content);

      if (config.mcpServers && config.mcpServers["obsidian-mcp-tools"]) {
        delete config.mcpServers["obsidian-mcp-tools"];
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
      }`,
    );
  }
}
