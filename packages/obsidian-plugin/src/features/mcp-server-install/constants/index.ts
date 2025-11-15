import { environmentVariables } from "./bundle-time" with { type: "macro" };

export const { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME } =
  environmentVariables();

export const BINARY_NAME = {
  windows: "mcp-server.exe",
  macos: "mcp-server",
  linux: "mcp-server",
} as const;

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
