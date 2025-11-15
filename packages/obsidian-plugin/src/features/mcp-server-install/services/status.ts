import type McpToolsPlugin from "$/main";
import { logger } from "$/shared/logger";
import { exec } from "child_process";
import fsp from "fs/promises";
import { Plugin } from "obsidian";
import path from "path";
import { clean, lt, valid } from "semver";
import { promisify } from "util";
import { BINARY_NAME } from "../constants";
import type { InstallationStatus, InstallPathInfo } from "../types";
import { getFileSystemAdapter } from "../utils/getFileSystemAdapter";
import { normalizeDuplicateSegments } from "../utils/normalizePath";
import { getPlatform } from "./install";

const execAsync = promisify(exec);

/**
 * Resolves the real path of the given file path, handling cases where the path is a symlink.
 *
 * @param filepath - The file path to resolve.
 * @returns The real path of the file.
 * @throws {Error} If the file is not found or the symlink cannot be resolved.
 */
async function resolveSymlinks(filepath: string): Promise<string> {
  try {
    return await fsp.realpath(filepath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const parts = path.normalize(filepath).split(path.sep);
      let resolvedParts: string[] = [];
      let skipCount = 1; // Skip first segment by default

      // Handle the root segment differently for Windows vs POSIX
      if (path.win32.isAbsolute(filepath)) {
        resolvedParts.push(parts[0]);
        if (parts[1] === "") {
          resolvedParts.push("");
          skipCount = 2; // Skip two segments for UNC paths
        }
      } else if (path.posix.isAbsolute(filepath)) {
        resolvedParts.push("/");
      } else {
        resolvedParts.push(parts[0]);
      }

      // Process remaining path segments
      for (const part of parts.slice(skipCount)) {
        const partialPath = path.join(...resolvedParts, part);
        try {
          const resolvedPath = await fsp.realpath(partialPath);
          resolvedParts = resolvedPath.split(path.sep);
        } catch (err) {
          resolvedParts.push(part);
        }
      }

      return path.join(...resolvedParts);
    }

    logger.error(`Failed to resolve symlink:`, {
      filepath,
      error: error instanceof Error ? error.message : error,
    });
    throw new Error(`Failed to resolve symlink: ${filepath}`);
  }
}

export async function getInstallPath(
  plugin: Plugin,
): Promise<InstallPathInfo | { error: string }> {
  const adapter = getFileSystemAdapter(plugin);
  if ("error" in adapter) return adapter;

  const platform = getPlatform(plugin);
  const originalPath = path.join(
    adapter.getBasePath(),
    plugin.app.vault.configDir,
    "plugins",
    plugin.manifest.id,
    "bin",
  );
  const realDirPath = await resolveSymlinks(originalPath);
  // Normalize path to remove any duplicate segments (e.g., /home/user/home/user/vault)
  const normalizedDirPath = normalizeDuplicateSegments(realDirPath);
  const platformSpecificBinary = BINARY_NAME[platform];
  const realFilePath = path.join(normalizedDirPath, platformSpecificBinary);
  return {
    dir: normalizedDirPath,
    path: realFilePath,
    name: platformSpecificBinary,
    symlinked: originalPath === normalizedDirPath ? undefined : originalPath,
  };
}

/**
 * Gets the current installation status of the MCP server
 */
export async function getInstallationStatus(
  plugin: McpToolsPlugin,
): Promise<InstallationStatus> {
  // Verify plugin version is valid
  const pluginVersion = valid(clean(plugin.manifest.version));
  if (!pluginVersion) {
    logger.error("Invalid plugin version:", { plugin });
    return { state: "error", versions: {} };
  }

  // Check for API key
  const apiKey = plugin.getLocalRestApiKey();
  if (!apiKey) {
    return {
      state: "no api key",
      versions: { plugin: pluginVersion },
    };
  }

  // Verify server binary is present
  const installPath = await getInstallPath(plugin);
  if ("error" in installPath) {
    return {
      state: "error",
      versions: { plugin: pluginVersion },
      error: installPath.error,
    };
  }

  try {
    await fsp.access(installPath.path, fsp.constants.X_OK);
  } catch (error) {
    logger.error("Failed to get server version:", { installPath });
    return {
      state: "not installed",
      ...installPath,
      versions: { plugin: pluginVersion },
    };
  }

  // Check server binary version
  let serverVersion: string | null | undefined;
  try {
    const versionCommand = `"${installPath.path}" --version`;
    const { stdout } = await execAsync(versionCommand);
    serverVersion = clean(stdout.trim());
    if (!serverVersion) throw new Error("Invalid server version string");
  } catch {
    logger.error("Failed to get server version:", { installPath });
    return {
      state: "error",
      ...installPath,
      versions: { plugin: pluginVersion },
    };
  }

  return {
    ...installPath,
    state: lt(serverVersion, pluginVersion) ? "outdated" : "installed",
    versions: { plugin: pluginVersion, server: serverVersion },
  };
}
