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

export const PLATFORM_TYPES = ["windows", "macos", "linux"] as const;
export type Platform = (typeof PLATFORM_TYPES)[number];

export const ARCH_TYPES = ["x64", "arm64"] as const;
export type Arch = (typeof ARCH_TYPES)[number];
