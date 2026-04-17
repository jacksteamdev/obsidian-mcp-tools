import type McpToolsPlugin from "$/main";
import { logger } from "$/shared/logger";
import { exec } from "child_process";
import fsp from "fs/promises";
import { Plugin } from "obsidian";
import os from "os";
import path from "path";
import { clean, lt, valid } from "semver";
import { promisify } from "util";
import { BINARY_NAME, INSTALL_PATH } from "../constants";
import type { InstallationStatus, InstallPathInfo } from "../types";
import { getFileSystemAdapter } from "../utils/getFileSystemAdapter";
import { getPlatform } from "./install";
import { removeDuplicatePathSegments } from "./pathSegments";

const execAsync = promisify(exec);

/**
 * Expands platform-specific path placeholders to absolute paths.
 *
 * Handles two conventions used by the install/log/config path
 * constants in `../constants/paths.ts`:
 *
 *   - POSIX leading tilde — `~/foo/bar` → `{os.homedir()}/foo/bar`
 *   - Windows env-var tokens — `%APPDATA%\foo` →
 *     `{process.env.APPDATA}\foo`
 *
 * Exported so tests (and future callers) can reuse the same
 * resolution logic. Mirrors the canonical implementation in
 * `services/config.ts`'s private `getConfigPath` — keep the two in
 * sync if you touch either.
 */
export function expandHomePath(template: string): string {
  let expanded = template;

  // Expand ~ to home directory if needed.
  if (expanded.startsWith("~")) {
    expanded = path.join(os.homedir(), expanded.slice(1));
  }

  // Expand %VAR% tokens on Windows-style paths. A missing env var
  // collapses to the empty string — matches the behavior of
  // `getConfigPath` in config.ts and keeps the two in lock-step.
  expanded = expanded.replace(
    /%([^%]+)%/g,
    (_, name) => process.env[name] || "",
  );

  return expanded;
}

/**
 * Resolves the real path of the given file path, handling cases where the path is a symlink.
 *
 * @param filepath - The file path to resolve.
 * @returns The real path of the file.
 * @throws {Error} If the file is not found or the symlink cannot be resolved.
 */
async function resolveSymlinks(filepath: string): Promise<string> {
  try {
    // Collapse any accidental duplicate segments that realpath may
    // produce on certain iCloud / symlinked vault layouts.
    const resolved = await fsp.realpath(filepath);
    return removeDuplicatePathSegments(resolved);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const parts = path.normalize(filepath).split(path.sep);
      let resolvedParts: string[] = [];
      let skipCount = 1; // Skip first segment by default

      // Check POSIX absoluteness *before* Win32 absoluteness. Rationale:
      // `path.win32.isAbsolute("/foo")` returns true because in Win32
      // a leading "/" is treated as the root of the current drive. On
      // Linux/macOS/WSL that branch would push `parts[0]` (an empty
      // string) instead of "/", producing a relative-looking path that
      // makes realpath resolve relative to CWD on the next iteration.
      if (path.posix.isAbsolute(filepath)) {
        resolvedParts.push("/");
      } else if (path.win32.isAbsolute(filepath)) {
        resolvedParts.push(parts[0]);
        if (parts[1] === "") {
          resolvedParts.push("");
          skipCount = 2; // Skip two segments for UNC paths
        }
      } else {
        resolvedParts.push(parts[0]);
      }

      // Process remaining path segments
      for (const part of parts.slice(skipCount)) {
        const partialPath = path.join(...resolvedParts, part);
        try {
          const resolvedPath = await fsp.realpath(partialPath);
          resolvedParts = resolvedPath.split(path.sep);
        } catch {
          resolvedParts.push(part);
        }
      }

      // `path.sep.split()` of an absolute POSIX path produces an array
      // whose first element is `""`, not `"/"`. When we recompose with
      // `path.join("", "foo", "bar")` the empty string is silently
      // dropped and we get a relative-looking `"foo/bar"` — so callers
      // that expect an absolute path (e.g. `ensureDirectory` before
      // install) would mkdir relative to CWD instead of the vault.
      // Prepend the separator back when we detect this case.
      const joined = path.join(...resolvedParts);
      if (resolvedParts[0] === "" && !joined.startsWith(path.sep)) {
        return path.sep + joined;
      }
      return joined;
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
  // Honor the user's platformOverride setting so the binary path
  // check matches whatever was installed. If the user switched the
  // override after a previous install, this ensures the old binary
  // name (e.g. `mcp-server.exe`) is no longer considered "present"
  // once the override points at a different OS.
  const settings = await plugin.loadData();
  const platform = getPlatform(settings?.platformOverride?.platform);
  const platformSpecificBinary = BINARY_NAME[platform];

  // New default (issue #28): `undefined` means "system", i.e. the
  // binary lives in the per-user Application Support directory so
  // vault sync services (iCloud, Git, Dropbox) stop replicating a
  // ~15MB binary across devices. `"vault"` is the legacy opt-in.
  const effectiveLocation: "vault" | "system" =
    settings?.installLocation ?? "system";

  if (effectiveLocation === "system") {
    // Build the path from a constant + the platform-specific
    // binary name. No realpath resolution here — the system path
    // is stable and is not expected to cross symlinks, and we
    // construct it ourselves so we don't need to trust an on-disk
    // directory layout that may not exist yet.
    const dir = expandHomePath(INSTALL_PATH[platform]);
    const filePath = path.join(dir, platformSpecificBinary);
    return {
      dir,
      path: filePath,
      name: platformSpecificBinary,
      symlinked: undefined,
    };
  }

  // Legacy "inside the vault" branch. Preserve the original
  // behavior including the symlink-resolution dance — iCloud and
  // certain Git-annex style vaults do actually hand us a symlinked
  // directory and the UI depends on the `symlinked` hint.
  const adapter = getFileSystemAdapter(plugin);
  if ("error" in adapter) return adapter;

  const originalPath = path.join(
    adapter.getBasePath(),
    plugin.app.vault.configDir,
    "plugins",
    plugin.manifest.id,
    "bin",
  );
  const realDirPath = await resolveSymlinks(originalPath);
  const realFilePath = path.join(realDirPath, platformSpecificBinary);
  return {
    dir: realDirPath,
    path: realFilePath,
    name: platformSpecificBinary,
    symlinked: originalPath === realDirPath ? undefined : originalPath,
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
  } catch {
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

/**
 * Probe for a legacy "inside the vault" server binary, independently
 * of the current `installLocation` setting.
 *
 * Used by the settings UI to decide whether to show the "migrate out
 * of vault" banner: even a user who has flipped `installLocation` to
 * `"system"` may still have a stale binary sitting in the vault from
 * a previous install. This function tells the UI whether that binary
 * exists, and — if it can be run — what version it reports.
 *
 * Semantics:
 *
 * - Uses the AUTO-DETECTED platform (`getPlatform()` with no
 *   override). We're looking for whatever is on disk right now,
 *   which was written by whatever platform the plugin was running
 *   on when the legacy install happened. An `platformOverride`
 *   flip should not hide a binary that genuinely exists.
 * - Never throws. A broken binary, a missing directory, a
 *   non-executable file, an unsupported adapter — all collapse to
 *   `null` (or `{ path, version: undefined }` if the file exists
 *   but `--version` exited non-zero).
 */
export async function detectLegacyVaultBinary(
  plugin: McpToolsPlugin,
): Promise<{ path: string; version?: string } | null> {
  const adapter = getFileSystemAdapter(plugin);
  if ("error" in adapter) return null;

  const platform = getPlatform();
  const vaultBinaryPath = path.join(
    adapter.getBasePath(),
    plugin.app.vault.configDir,
    "plugins",
    plugin.manifest.id,
    "bin",
    BINARY_NAME[platform],
  );

  try {
    await fsp.access(vaultBinaryPath, fsp.constants.X_OK);
  } catch {
    return null;
  }

  // Try to read the version string, but tolerate a broken binary.
  // The UI still wants to know the file exists even if it can't be
  // executed — that's the exact state the migration flow is meant
  // to resolve.
  let version: string | undefined;
  try {
    const { stdout } = await execAsync(`"${vaultBinaryPath}" --version`);
    version = clean(stdout.trim()) ?? undefined;
  } catch {
    version = undefined;
  }

  return { path: vaultBinaryPath, version };
}
