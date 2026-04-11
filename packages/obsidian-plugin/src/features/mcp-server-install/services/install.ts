import fs from "fs";
import fsp from "fs/promises";
import https from "https";
import { Notice, Plugin } from "obsidian";
import os from "os";
import path from "path";
import { Observable } from "rxjs";
import { logger } from "$/shared";
import type McpToolsPlugin from "$/main";
import {
  ARCH_TYPES,
  GITHUB_DOWNLOAD_URL,
  PLATFORM_TYPES,
  type Arch,
  type Platform,
} from "../constants";
import type { DownloadProgress, InstallPathInfo } from "../types";
import { serializeDisabledToolsToEnv } from "../../tool-toggle";
import { updateClaudeConfig } from "./config";
import { detectLegacyVaultBinary, getInstallPath } from "./status";

/**
 * Check whether an arbitrary string is a valid `Platform` literal.
 * Exported so callers (settings UI, tests) can validate user input
 * before passing it as an override to `getPlatform`.
 */
export function isPlatform(value: unknown): value is Platform {
  return (
    typeof value === "string" &&
    (PLATFORM_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Check whether an arbitrary string is a valid `Arch` literal.
 */
export function isArch(value: unknown): value is Arch {
  return (
    typeof value === "string" &&
    (ARCH_TYPES as readonly string[]).includes(value)
  );
}

/**
 * Resolve the Platform the installer should use. Priority:
 *
 *   1. Explicit `override` argument (set by callers that read the
 *      plugin's `platformOverride` setting from `plugin.loadData()`).
 *   2. `OBSIDIAN_SERVER_PLATFORM` env var escape hatch for users
 *      running Obsidian under WSL, Bottles, wine, or other
 *      translation layers where `os.platform()` auto-detect gives
 *      the wrong answer.
 *   3. `os.platform()` auto-detect.
 *
 * Invalid override values (typos, unsupported platforms) fall
 * through to the next priority level instead of throwing — an
 * install-time error is worse than a graceful fallback to the
 * auto-detected default.
 */
export function getPlatform(override?: Platform): Platform {
  if (override && isPlatform(override)) return override;

  const envOverride = process.env.OBSIDIAN_SERVER_PLATFORM;
  if (envOverride && isPlatform(envOverride)) return envOverride;

  const platform = os.platform();
  switch (platform) {
    case "darwin":
      return "macos";
    case "win32":
      return "windows";
    default:
      return "linux";
  }
}

/**
 * Resolve the Arch the installer should use. Same priority as
 * `getPlatform`: explicit override → `OBSIDIAN_SERVER_ARCH` env var →
 * `os.arch()` auto-detect.
 */
export function getArch(override?: Arch): Arch {
  if (override && isArch(override)) return override;

  const envOverride = process.env.OBSIDIAN_SERVER_ARCH;
  if (envOverride && isArch(envOverride)) return envOverride;

  return os.arch() as Arch;
}

export function getDownloadUrl(platform: Platform, arch: Arch): string {
  if (platform === "windows") {
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-windows.exe`;
  } else if (platform === "macos") {
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-macos-${arch}`;
  } else { // linux
    return `${GITHUB_DOWNLOAD_URL}/mcp-server-linux`;  // Linux binary doesn't include arch in filename
  }
}

/**
 * Ensures that the specified directory path exists and is writable.
 *
 * If the directory does not exist, it will be created recursively. If the directory
 * exists but is not writable, an error will be thrown.
 *
 * @param dirpath - The real directory path to ensure exists and is writable.
 * @throws {Error} If the directory does not exist or is not writable.
 */
export async function ensureDirectory(dirpath: string) {
  try {
    if (!fs.existsSync(dirpath)) {
      await fsp.mkdir(dirpath, { recursive: true });
    }

    // Verify directory was created and is writable
    try {
      await fsp.access(dirpath, fs.constants.W_OK);
    } catch (accessError) {
      throw new Error(`Directory exists but is not writable: ${dirpath}`);
    }
  } catch (error) {
    logger.error(`Failed to ensure directory:`, { error });
    throw error;
  }
}

export function downloadFile(
  url: string,
  outputPath: string,
  redirects = 0,
): Observable<DownloadProgress> {
  return new Observable((subscriber) => {
    if (redirects > 5) {
      subscriber.error(new Error("Too many redirects"));
      return;
    }

    let fileStream: fs.WriteStream | undefined;
    const cleanup = (err?: unknown) => {
      if (err) {
        logger.debug("Cleaning up incomplete download:", {
          outputPath,
          writableFinished: JSON.stringify(fileStream?.writableFinished),
          error: err instanceof Error ? err.message : String(err),
        });
        fileStream?.destroy();
        fsp.unlink(outputPath).catch((unlinkError) => {
          logger.error("Failed to clean up incomplete download:", {
            outputPath,
            error:
              unlinkError instanceof Error
                ? unlinkError.message
                : String(unlinkError),
          });
        });
      } else {
        fileStream?.close();
        fsp.chmod(outputPath, 0o755).catch((chmodError) => {
          logger.error("Failed to set executable permissions:", {
            outputPath,
            error:
              chmodError instanceof Error
                ? chmodError.message
                : String(chmodError),
          });
        });
      }
    };

    https
      .get(url, (response) => {
        try {
          if (!response) {
            throw new Error("No response received");
          }

          const statusCode = response.statusCode ?? 0;

          // Handle various HTTP status codes
          if (statusCode >= 400) {
            throw new Error(
              `HTTP Error ${statusCode}: ${response.statusMessage}`,
            );
          }

          if (statusCode === 302 || statusCode === 301) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              throw new Error(
                `Redirect (${statusCode}) received but no location header found`,
              );
            }

            // Handle redirect by creating a new observable
            downloadFile(redirectUrl, outputPath, redirects + 1).subscribe(
              subscriber,
            );
            return;
          }

          if (statusCode !== 200) {
            throw new Error(`Unexpected status code: ${statusCode}`);
          }

          // Validate content length
          const contentLength = response.headers["content-length"];
          const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
          if (contentLength && isNaN(totalBytes)) {
            throw new Error("Invalid content-length header");
          }

          try {
            fileStream = fs.createWriteStream(outputPath, {
              flags: "w",
            });
          } catch (err) {
            throw new Error(
              `Failed to create write stream: ${err instanceof Error ? err.message : String(err)}`,
            );
          }

          let downloadedBytes = 0;

          fileStream.on("error", (err) => {
            const fileStreamError = new Error(
              `File stream error: ${err.message}`,
            );
            cleanup(fileStreamError);
            subscriber.error(fileStreamError);
          });

          response.on("data", (chunk: Buffer) => {
            try {
              if (!Buffer.isBuffer(chunk)) {
                throw new Error("Received invalid data chunk");
              }

              downloadedBytes += chunk.length;
              const percentage = totalBytes
                ? (downloadedBytes / totalBytes) * 100
                : 0;

              subscriber.next({
                bytesReceived: downloadedBytes,
                totalBytes,
                percentage: Math.round(percentage * 100) / 100,
              });
            } catch (err) {
              cleanup(err);
              subscriber.error(err);
            }
          });

          response.pipe(fileStream);

          fileStream.on("finish", () => {
            cleanup();
            subscriber.complete();
          });

          response.on("error", (err) => {
            cleanup(err);
            subscriber.error(new Error(`Response error: ${err.message}`));
          });
        } catch (err) {
          cleanup(err);
          subscriber.error(err instanceof Error ? err : new Error(String(err)));
        }
      })
      .on("error", (err) => {
        cleanup(err);
        subscriber.error(new Error(`Network error: ${err.message}`));
      });
  });
}

export async function installMcpServer(
  plugin: Plugin,
): Promise<InstallPathInfo> {
  try {
    // Honor any platform/arch override the user has set via the
    // settings UI before falling through to env vars and auto-detect.
    // getPlatform/getArch validate the override and degrade
    // gracefully on invalid values.
    const settings = await plugin.loadData();
    const platform = getPlatform(settings?.platformOverride?.platform);
    const arch = getArch(settings?.platformOverride?.arch);
    const downloadUrl = getDownloadUrl(platform, arch);
    const installPath = await getInstallPath(plugin);
    if ("error" in installPath) throw new Error(installPath.error);

    await ensureDirectory(installPath.dir);

    const progressNotice = new Notice("Downloading MCP server...", 0);
    logger.debug("Downloading MCP server:", { downloadUrl, installPath });

    const download$ = downloadFile(downloadUrl, installPath.path);

    return new Promise((resolve, reject) => {
      download$.subscribe({
        next: (progress: DownloadProgress) => {
          progressNotice.setMessage(
            `Downloading MCP server: ${progress.percentage}%`,
          );
        },
        error: (error: Error) => {
          progressNotice.hide();
          new Notice(`Failed to download MCP server: ${error.message}`);
          logger.error("Download failed:", { error, installPath });
          reject(error);
        },
        complete: () => {
          progressNotice.hide();
          new Notice("MCP server downloaded successfully!");
          logger.info("MCP server downloaded", { installPath });
          resolve(installPath);
        },
      });
    });
  } catch (error) {
    new Notice(
      `Failed to install MCP server: ${error instanceof Error ? error.message : String(error)}`,
    );
    throw error;
  }
}

/**
 * Migrate an existing "inside the vault" install to the new default
 * system path (issue #28).
 *
 * Flow:
 *
 *   1. Snapshot the old `installLocation` setting for rollback.
 *   2. Locate the legacy vault binary (auto-detected platform —
 *      independent of any override) so we know what to clean up
 *      later. Done BEFORE mutating settings: once we flip the
 *      setting, `getInstallPath` stops pointing at the vault.
 *   3. Delete `installLocation` from the persisted settings (so
 *      the `undefined → "system"` default kicks in) and save.
 *   4. Call `installMcpServer` which now downloads into the
 *      system path. On failure, rollback the setting and rethrow.
 *   5. Best-effort update of the Claude Desktop config so it
 *      points at the new binary location. Failure here is logged
 *      but does NOT roll back — the binary is already at the new
 *      location, and a stale client config pointing at the old
 *      path is a degraded-but-non-fatal state. The user can click
 *      "Reinstall" in settings to recover.
 *   6. Best-effort cleanup of the old vault binary. Failure here
 *      is also logged but non-fatal; the migration is considered
 *      successful once the new binary is in place.
 *
 * Returns the `InstallPathInfo` for the new install location so
 * callers can update their in-memory state / display the new path.
 */
export async function migrateFromVaultToSystem(
  plugin: McpToolsPlugin,
): Promise<InstallPathInfo> {
  // Step 1: snapshot the current setting so we can roll back if
  // the install step fails. Use `in` so we preserve the
  // distinction between "explicitly undefined" and "absent" —
  // rollback must restore the exact prior shape.
  const settingsBefore = (await plugin.loadData()) ?? {};
  const hadInstallLocationKey = "installLocation" in settingsBefore;
  const previousLocation: "vault" | "system" | undefined =
    settingsBefore.installLocation;

  // Step 2: locate the legacy binary BEFORE we touch settings.
  // `detectLegacyVaultBinary` uses the auto-detected platform and
  // does not honor `installLocation`, so it is safe to call here
  // and also after the setting flip if we wanted — but calling it
  // once up front keeps the cleanup target stable.
  const legacy = await detectLegacyVaultBinary(plugin);

  // Step 3: flip the setting to the new default by deleting the
  // key entirely. `installLocation === undefined` means "system"
  // per types.ts.
  const settingsForMigration = { ...settingsBefore };
  delete settingsForMigration.installLocation;
  await plugin.saveData(settingsForMigration);

  // Step 4: run the normal install. This now targets the system
  // path because the setting has changed. On failure, restore the
  // previous setting so the UI does not end up in a split state.
  let newPath: InstallPathInfo;
  try {
    newPath = await installMcpServer(plugin);
  } catch (installError) {
    try {
      const rollback = { ...settingsForMigration };
      if (hadInstallLocationKey) {
        rollback.installLocation = previousLocation;
      }
      await plugin.saveData(rollback);
    } catch (rollbackError) {
      // The install failed AND we couldn't rollback. This is the
      // worst-case branch — log both errors and still rethrow the
      // original one so the UI surfaces the actionable message.
      logger.error(
        "Failed to rollback installLocation after failed migration:",
        {
          rollbackError:
            rollbackError instanceof Error
              ? rollbackError.message
              : String(rollbackError),
        },
      );
    }
    throw installError;
  }

  // Step 5: best-effort update of the Claude Desktop config. A
  // failure here leaves the client config pointing at the old
  // vault path — degraded but non-fatal. We log a warning and
  // continue; the user can recover via the "Reinstall" button.
  try {
    const apiKey = await plugin.getLocalRestApiKey();
    const settingsAfter = (await plugin.loadData()) ?? {};
    const disabled = settingsAfter.toolToggle?.disabled ?? [];
    const envOverrides: Record<string, string> = {};
    const serialized = serializeDisabledToolsToEnv(disabled);
    if (serialized !== undefined) {
      envOverrides.OBSIDIAN_DISABLED_TOOLS = serialized;
    }
    await updateClaudeConfig(plugin, newPath.path, apiKey, envOverrides);
  } catch (configError) {
    logger.warn(
      "Migration succeeded but Claude config update failed; " +
        "client config still points at the old vault binary path. " +
        "User can fix via the 'Reinstall' button in settings.",
      {
        error:
          configError instanceof Error
            ? configError.message
            : String(configError),
      },
    );
  }

  // Step 6: best-effort cleanup of the legacy vault binary. If the
  // user dropped sidecar files in the bin/ directory, rmdir will
  // fail with ENOTEMPTY — we swallow that. Same goes for ENOENT if
  // something else already removed the file between the probe and
  // the cleanup.
  if (legacy) {
    try {
      await fsp.unlink(legacy.path);
      logger.info("Removed legacy vault binary after migration", {
        path: legacy.path,
      });
    } catch (unlinkError) {
      const code = (unlinkError as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        logger.warn(
          "Failed to remove legacy vault binary after migration; " +
            "leaving it in place (non-fatal).",
          {
            path: legacy.path,
            error:
              unlinkError instanceof Error
                ? unlinkError.message
                : String(unlinkError),
          },
        );
      }
    }

    try {
      await fsp.rmdir(path.dirname(legacy.path));
    } catch (rmdirError) {
      const code = (rmdirError as NodeJS.ErrnoException).code;
      if (code !== "ENOTEMPTY" && code !== "ENOENT") {
        logger.warn(
          "Failed to remove legacy vault bin/ directory after " +
            "migration; leaving it in place (non-fatal).",
          {
            dir: path.dirname(legacy.path),
            error:
              rmdirError instanceof Error
                ? rmdirError.message
                : String(rmdirError),
          },
        );
      }
    }
  }

  return newPath;
}
