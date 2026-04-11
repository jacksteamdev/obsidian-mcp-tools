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
    /**
     * Where the installer places the server binary.
     *
     * - `undefined` (the new default as of issue #28) — semantically
     *   equivalent to `"system"`. The binary lives in the standard
     *   per-user application directory (see `INSTALL_PATH` in
     *   `./constants/paths.ts`) so vault sync services (iCloud, Git,
     *   Dropbox) don't replicate a ~15MB binary across devices.
     * - `"system"` — explicitly selected system-path install. Same
     *   behavior as `undefined`, but pins the choice so a future
     *   default flip won't silently migrate the user.
     * - `"vault"` — legacy opt-in. Binary is written inside the
     *   vault at `{vault}/.obsidian/plugins/{pluginId}/bin`. Kept
     *   for users who intentionally want the binary to ride along
     *   with their vault (e.g. portable install on a USB stick).
     */
    installLocation?: "vault" | "system";
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
