import { execFile } from "child_process";
import { Notice, Platform } from "obsidian";
import { logger } from "$/shared/logger";

/**
 * Opens a folder in the system's default file explorer
 */
export function openFolder(folderPath: string): void {
  // Windows: use cmd /c start because explorer returns non-zero exit codes on success
  const [cmd, args]: [string, string[]] = Platform.isWin
    ? ["cmd", ["/c", "start", "", folderPath]]
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
