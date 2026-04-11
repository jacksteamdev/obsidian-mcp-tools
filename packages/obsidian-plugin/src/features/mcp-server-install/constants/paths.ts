/**
 * Static platform-specific paths and binary names for the installer.
 *
 * Isolated in its own module (with no macro imports) so these constants
 * can be imported from unit tests via `bun:test` without triggering
 * `with { type: "macro" }` resolution for the bundle-time env vars
 * declared in `./index.ts`.
 */

export const BINARY_NAME = {
  windows: "mcp-server.exe",
  macos: "mcp-server",
  linux: "mcp-server",
} as const;

// NOTE: the Linux path uses capital-C "Claude" (matching macOS and Windows)
// and the full `claude_desktop_config.json` filename. Earlier versions
// pointed to `~/.config/claude/config.json`, which is not where Claude
// Desktop actually stores its config on Linux — see issue #31.
export const CLAUDE_CONFIG_PATH = {
  macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
  windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
  linux: "~/.config/Claude/claude_desktop_config.json",
} as const;

export const LOG_PATH = {
  macos: "~/Library/Logs/obsidian-mcp-tools",
  windows: "%APPDATA%\\obsidian-mcp-tools\\logs",
  linux: "~/.local/share/obsidian-mcp-tools/logs",
} as const;

// Default installation directory for the server binary when the
// user has opted out of the legacy "inside the vault" install
// location (issue #28). These are the stable per-user locations
// for each platform; the `~` and `%APPDATA%` placeholders are
// expanded at runtime via `expandHomePath` in services/status.ts.
export const INSTALL_PATH = {
  macos: "~/Library/Application Support/obsidian-mcp-tools/bin",
  windows: "%APPDATA%\\obsidian-mcp-tools\\bin",
  linux: "~/.local/share/obsidian-mcp-tools/bin",
} as const;

export const PLATFORM_TYPES = ["windows", "macos", "linux"] as const;
export type Platform = (typeof PLATFORM_TYPES)[number];

export const ARCH_TYPES = ["x64", "arm64"] as const;
export type Arch = (typeof ARCH_TYPES)[number];
