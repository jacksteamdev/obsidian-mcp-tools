import type { Templater, SmartConnections } from "shared";

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
