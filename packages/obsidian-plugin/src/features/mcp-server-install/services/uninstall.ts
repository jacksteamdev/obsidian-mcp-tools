import { logger } from "$/shared/logger";
import fsp from "fs/promises";
import { Plugin } from "obsidian";
import { removeFromClaudeConfig } from "./config";
import { getInstallPath } from "./status";

/**
 * Uninstalls the MCP server by removing the binary and cleaning up configuration
 */
export async function uninstallServer(plugin: Plugin): Promise<void> {
  try {
    // Resolve and validate install path (includes symlink containment check)
    const installPath = await getInstallPath(plugin);
    if ("error" in installPath) {
      throw new Error(installPath.error);
    }

    // Remove binary
    try {
      await fsp.unlink(installPath.path);
      logger.info("Removed server binary", { binaryPath: installPath.path });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // File doesn't exist, continue
    }

    // Remove bin directory if empty
    try {
      await fsp.rmdir(installPath.dir);
      logger.info("Removed empty bin directory", { binDir: installPath.dir });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOTEMPTY") {
        throw error;
      }
      // Directory not empty, leave it
    }

    // Remove our entry from Claude config (cross-platform)
    await removeFromClaudeConfig();

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
