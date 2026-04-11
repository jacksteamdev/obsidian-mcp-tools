import { describe, expect, test } from "bun:test";
// Import from the macro-free module so the test does not trigger the
// `environmentVariables()` macro declared in ./index.ts.
import {
  BINARY_NAME,
  CLAUDE_CONFIG_PATH,
  LOG_PATH,
  PLATFORM_TYPES,
} from "./paths";

describe("CLAUDE_CONFIG_PATH", () => {
  test("macOS points to ~/Library/Application Support/Claude/", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toBe(
      "~/Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  test("Windows points to %APPDATA%\\Claude\\", () => {
    expect(CLAUDE_CONFIG_PATH.windows).toBe(
      "%APPDATA%\\Claude\\claude_desktop_config.json",
    );
  });

  test("Linux uses capital-C Claude and the full config filename (issue #31)", () => {
    // The previous value was "~/.config/claude/config.json" which did
    // not match Claude Desktop's actual Linux install location. The
    // correct path mirrors macOS/Windows: capital-C Claude directory
    // and the full `claude_desktop_config.json` filename.
    expect(CLAUDE_CONFIG_PATH.linux).toBe(
      "~/.config/Claude/claude_desktop_config.json",
    );
  });

  test("all platforms end with claude_desktop_config.json", () => {
    for (const platform of PLATFORM_TYPES) {
      expect(CLAUDE_CONFIG_PATH[platform]).toEndWith(
        "claude_desktop_config.json",
      );
    }
  });

  test("all platforms contain the Claude directory with capital C", () => {
    expect(CLAUDE_CONFIG_PATH.macos).toContain("/Claude/");
    expect(CLAUDE_CONFIG_PATH.windows).toContain("\\Claude\\");
    expect(CLAUDE_CONFIG_PATH.linux).toContain("/Claude/");
  });
});

describe("LOG_PATH", () => {
  test("macOS log path uses ~/Library/Logs", () => {
    expect(LOG_PATH.macos).toBe("~/Library/Logs/obsidian-mcp-tools");
  });

  test("Windows log path uses %APPDATA%", () => {
    expect(LOG_PATH.windows).toBe("%APPDATA%\\obsidian-mcp-tools\\logs");
  });

  test("Linux log path follows XDG conventions (~/.local/share)", () => {
    expect(LOG_PATH.linux).toBe("~/.local/share/obsidian-mcp-tools/logs");
  });

  test("all platforms have log paths containing obsidian-mcp-tools", () => {
    for (const platform of PLATFORM_TYPES) {
      expect(LOG_PATH[platform]).toContain("obsidian-mcp-tools");
    }
  });
});

describe("BINARY_NAME", () => {
  test("Windows binary has .exe suffix", () => {
    expect(BINARY_NAME.windows).toBe("mcp-server.exe");
  });

  test("macOS binary has no extension", () => {
    expect(BINARY_NAME.macos).toBe("mcp-server");
  });

  test("Linux binary has no extension", () => {
    expect(BINARY_NAME.linux).toBe("mcp-server");
  });
});
