import fs from "fs";
import fsp from "fs/promises";
import https from "https";
import { Notice, Plugin, type McpToolsPluginSettings } from "obsidian";
import os from "os";
import { Observable } from "rxjs";
import { logger } from "$/shared";
import { GITHUB_DOWNLOAD_URL, type Arch, type Platform } from "../constants";
import type { DownloadProgress, InstallPathInfo } from "../types";
import { getInstallPath } from "./status";

export function getPlatform(plugin?: Plugin): Platform {
  // Check for custom platform override in settings
  if (plugin) {
    const settings = (plugin as any).settings as McpToolsPluginSettings;
    if (settings?.customPlatform) {
      return settings.customPlatform;
    }
  }

  // Fall back to detected platform
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

export function getArch(plugin?: Plugin): Arch {
  // Check for custom architecture override in settings
  if (plugin) {
    const settings = (plugin as any).settings as McpToolsPluginSettings;
    if (settings?.customArch) {
      return settings.customArch;
    }
  }

  // Fall back to detected architecture
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
    const platform = getPlatform(plugin);
    const arch = getArch(plugin);
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
