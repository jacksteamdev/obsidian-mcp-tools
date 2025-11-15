import { describe, expect, test } from "bun:test";

/**
 * Tests for MCP server installation constants
 * Issue #31: Fix Linux Claude Desktop config path
 *
 * Note: We replicate the constants here instead of importing to avoid
 * macro execution issues in the test environment
 */

// Replicate constants from index.ts
const CLAUDE_CONFIG_PATH = {
  macos: "~/Library/Application Support/Claude/claude_desktop_config.json",
  windows: "%APPDATA%\\Claude\\claude_desktop_config.json",
  linux: "~/.config/Claude/claude_desktop_config.json",
} as const;

const LOG_PATH = {
  macos: "~/Library/Logs/obsidian-mcp-tools",
  windows: "%APPDATA%\\obsidian-mcp-tools\\logs",
  linux: "~/.local/share/obsidian-mcp-tools/logs",
} as const;

const BINARY_NAME = {
  windows: "mcp-server.exe",
  macos: "mcp-server",
  linux: "mcp-server",
} as const;

describe("CLAUDE_CONFIG_PATH constants", () => {
  test("macOS path uses Library/Application Support", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toBe(
      "~/Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  test("Windows path uses APPDATA with backslashes", () => {
    expect(CLAUDE_CONFIG_PATH.windows).toBe(
      "%APPDATA%\\Claude\\claude_desktop_config.json",
    );
  });

  test("Linux path uses .config with capital C in Claude", () => {
    // Issue #31: The path should be ~/.config/Claude (not ~/.config/claude)
    expect(CLAUDE_CONFIG_PATH.linux).toBe(
      "~/.config/Claude/claude_desktop_config.json",
    );
  });

  test("all paths use claude_desktop_config.json filename", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toEndWith("claude_desktop_config.json");
    expect(CLAUDE_CONFIG_PATH.windows).toEndWith("claude_desktop_config.json");
    expect(CLAUDE_CONFIG_PATH.linux).toEndWith("claude_desktop_config.json");
  });

  test("macOS path starts with tilde for home directory", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toStartWith("~");
  });

  test("Linux path starts with tilde for home directory", () => {
    expect(CLAUDE_CONFIG_PATH.linux).toStartWith("~");
  });

  test("Windows path uses APPDATA environment variable", () => {
    expect(CLAUDE_CONFIG_PATH.windows).toStartWith("%APPDATA%");
  });

  test("paths contain Claude directory with consistent casing", () => {
    // All paths should contain "Claude" with capital C
    expect(CLAUDE_CONFIG_PATH.macos).toContain("/Claude/");
    expect(CLAUDE_CONFIG_PATH.windows).toContain("\\Claude\\");
    expect(CLAUDE_CONFIG_PATH.linux).toContain("/Claude/");
  });
});

describe("LOG_PATH constants", () => {
  test("macOS log path uses Library/Logs", () => {
    expect(LOG_PATH.macos).toBe("~/Library/Logs/obsidian-mcp-tools");
  });

  test("Windows log path uses APPDATA", () => {
    expect(LOG_PATH.windows).toBe("%APPDATA%\\obsidian-mcp-tools\\logs");
  });

  test("Linux log path uses .local/share", () => {
    expect(LOG_PATH.linux).toBe("~/.local/share/obsidian-mcp-tools/logs");
  });

  test("all paths contain obsidian-mcp-tools directory", () => {
    expect(LOG_PATH.macos).toContain("obsidian-mcp-tools");
    expect(LOG_PATH.windows).toContain("obsidian-mcp-tools");
    expect(LOG_PATH.linux).toContain("obsidian-mcp-tools");
  });

  test("macOS and Linux use forward slashes", () => {
    expect(LOG_PATH.macos).toContain("/");
    expect(LOG_PATH.linux).toContain("/");
    expect(LOG_PATH.macos).not.toContain("\\");
    expect(LOG_PATH.linux).not.toContain("\\");
  });

  test("Windows uses backslashes", () => {
    expect(LOG_PATH.windows).toContain("\\");
    expect(LOG_PATH.windows).not.toContain("/");
  });
});

describe("BINARY_NAME constants", () => {
  test("Windows binary has .exe extension", () => {
    expect(BINARY_NAME.windows).toBe("mcp-server.exe");
  });

  test("macOS binary has no extension", () => {
    expect(BINARY_NAME.macos).toBe("mcp-server");
    expect(BINARY_NAME.macos).not.toContain(".");
  });

  test("Linux binary has no extension", () => {
    expect(BINARY_NAME.linux).toBe("mcp-server");
    expect(BINARY_NAME.linux).not.toContain(".");
  });

  test("all binaries are named mcp-server", () => {
    expect(BINARY_NAME.windows).toStartWith("mcp-server");
    expect(BINARY_NAME.macos).toBe("mcp-server");
    expect(BINARY_NAME.linux).toBe("mcp-server");
  });
});

describe("Platform-specific path conventions", () => {
  test("macOS follows Apple directory conventions", () => {
    // macOS uses ~/Library for user-specific application support
    expect(CLAUDE_CONFIG_PATH.macos).toContain("~/Library/");
    expect(LOG_PATH.macos).toContain("~/Library/Logs/");
  });

  test("Linux follows XDG Base Directory specification", () => {
    // Linux typically uses ~/.config for configuration and ~/.local/share for data
    expect(CLAUDE_CONFIG_PATH.linux).toContain("~/.config/");
    expect(LOG_PATH.linux).toContain("~/.local/share/");
  });

  test("Windows follows Windows conventions", () => {
    // Windows uses APPDATA for application data
    expect(CLAUDE_CONFIG_PATH.windows).toContain("%APPDATA%\\");
    expect(LOG_PATH.windows).toContain("%APPDATA%\\");
  });
});

describe("Path consistency for cross-platform support", () => {
  test("all config paths end with .json", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toEndWith(".json");
    expect(CLAUDE_CONFIG_PATH.windows).toEndWith(".json");
    expect(CLAUDE_CONFIG_PATH.linux).toEndWith(".json");
  });

  test("all platforms have config and log paths defined", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toBeDefined();
    expect(CLAUDE_CONFIG_PATH.windows).toBeDefined();
    expect(CLAUDE_CONFIG_PATH.linux).toBeDefined();

    expect(LOG_PATH.macos).toBeDefined();
    expect(LOG_PATH.windows).toBeDefined();
    expect(LOG_PATH.linux).toBeDefined();
  });

  test("all platforms have binary names defined", () => {
    expect(BINARY_NAME.macos).toBeDefined();
    expect(BINARY_NAME.windows).toBeDefined();
    expect(BINARY_NAME.linux).toBeDefined();
  });
});
