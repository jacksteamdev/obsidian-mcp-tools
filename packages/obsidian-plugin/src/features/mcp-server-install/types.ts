import type { Templater, SmartConnections } from "shared";
import type { Arch, Platform } from "./constants";

/**
 * Persisted settings for the installer feature. Stored under the
 * `platformOverride` key in `plugin.loadData()` so users can force
 * a specific binary target from the settings UI — intended for
 * WSL / Bottles / wine scenarios where `os.platform()` auto-detect
 * is wrong.
 *
 * Augmentation lives here (not in the global `src/types.ts`) so the
 * installer feature stays self-contained per the .clinerules rule.
 */
declare module "obsidian" {
  interface McpToolsPluginSettings {
    platformOverride?: {
      platform?: Platform;
      arch?: Arch;
    };
  }
}

export interface SetupResult {
  success: boolean;
  error?: string;
}

export interface DownloadProgress {
  percentage: number;
  bytesReceived: number;
  totalBytes: number;
}

export interface InstallationStatus {
  state:
    | "no api key"
    | "not installed"
    | "installed"
    | "installing"
    | "outdated"
    | "uninstalling"
    | "error";
  error?: string;
  dir?: string;
  path?: string;
  versions: {
    plugin?: string;
    server?: string;
  };
}

export interface InstallPathInfo {
  /** The install directory path with all symlinks resolved */
  dir: string;
  /** The install filepath with all symlinks resolved */
  path: string;
  /** The platform-specific filename */
  name: string;
  /** The symlinked install path, if symlinks were found */
  symlinked?: string;
}

// Augment Obsidian's App type to include plugins
declare module "obsidian" {
  interface App {
    plugins: {
      plugins: {
        ["obsidian-local-rest-api"]?: {
          settings?: {
            apiKey?: string;
          };
        };
        ["smart-connections"]?: {
          env?: SmartConnections.SmartSearch;
        } & Plugin;
        ["templater-obsidian"]?: {
          templater?: Templater.ITemplater;
        };
      };
    };
  }
}
