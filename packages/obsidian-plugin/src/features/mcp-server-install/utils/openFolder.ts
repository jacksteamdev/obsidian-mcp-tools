import { execFile } from "child_process";
import { Notice, Platform } from "obsidian";
import { logger } from "$/shared/logger";

/**
 * Opens a folder in the system's default file explorer
 */
export function openFolder(folderPath: string): void {
  const [cmd, args]: [string, string[]] = Platform.isWin
    ? ["explorer", [folderPath]]
    : Platform.isMacOS
      ? ["open", [folderPath]]
      : ["xdg-open", [folderPath]];

  execFile(cmd, args, (error: Error | null) => {
    if (error) {
      const message = `Failed to open folder: ${error.message}`;
      logger.error(message, { folderPath, error });
      new Notice(message);
    }
  });
}
