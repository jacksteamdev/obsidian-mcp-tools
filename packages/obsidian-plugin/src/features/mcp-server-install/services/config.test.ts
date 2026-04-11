import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
  type Mock,
} from "bun:test";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { removeFromClaudeConfig, updateClaudeConfig } from "./config";

/**
 * End-to-end tests for the Claude Desktop config writer. Strategy:
 *
 * - Create a real temp directory per test as the fake HOME.
 * - Stub `os.homedir()` via `spyOn` so `getConfigPath()`'s tilde
 *   expansion lands inside the sandbox. We cannot rely on setting
 *   `process.env.HOME` — Bun/Node read the effective UID once and
 *   do not re-resolve it on env changes at runtime.
 * - The `plugin` parameter of updateClaudeConfig is `unknown` and
 *   unused in the function body; we pass `null` to make it explicit.
 *
 * Platform scope: these tests run only on macOS because
 * `getConfigPath()` branches on `os.platform()` at call time. The
 * macOS branch is what this project's primary users hit. The Linux
 * branch is separately guarded by `CLAUDE_CONFIG_PATH.linux` in
 * `constants.test.ts`. Windows (`%APPDATA%`) is not covered here.
 */

describe("updateClaudeConfig", () => {
  if (os.platform() !== "darwin") {
    test.skip("updateClaudeConfig tests run only on macOS", () => {});
    return;
  }

  let tmpRoot: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-config-test-"),
    );
    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("creates the config file and its parent directory when missing", async () => {
    // Sanity check: neither the file nor its Claude directory exist
    // before the call. The writer must recursively mkdir.
    await expect(fsp.access(configPath)).rejects.toThrow();

    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content).toEqual({
      mcpServers: {
        "obsidian-mcp-tools": {
          command: "/abs/path/to/mcp-server",
          env: {
            OBSIDIAN_API_KEY: "test-api-key",
          },
        },
      },
    });
  });

  test("preserves unrelated MCP server entries already in the config", async () => {
    // A user may have configured other MCP servers before installing
    // this plugin. The writer must not clobber them — only our own
    // `obsidian-mcp-tools` entry is ours to rewrite.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "some-other-server": {
            command: "/usr/bin/other-mcp",
            env: { FOO: "bar" },
          },
        },
        unrelatedTopLevelKey: "preserve me",
      }),
    );

    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["some-other-server"]).toEqual({
      command: "/usr/bin/other-mcp",
      env: { FOO: "bar" },
    });
    expect(content.mcpServers["obsidian-mcp-tools"].command).toBe(
      "/abs/path/to/mcp-server",
    );
    // Non-mcpServers top-level keys should also survive the rewrite.
    // Note: today's implementation parses and re-serializes the full
    // config, so unrelated top-level keys ride along for free — this
    // test pins that behavior so a future refactor cannot silently
    // drop user data.
    expect(content.unrelatedTopLevelKey).toBe("preserve me");
  });

  test("merges extraEnv into the env block alongside OBSIDIAN_API_KEY", async () => {
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
      {
        OBSIDIAN_DISABLED_TOOLS: "patch_vault_file, delete_vault_file",
        OBSIDIAN_HOST: "192.168.1.50",
      },
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content.mcpServers["obsidian-mcp-tools"].env).toEqual({
      OBSIDIAN_API_KEY: "test-api-key",
      OBSIDIAN_DISABLED_TOOLS: "patch_vault_file, delete_vault_file",
      OBSIDIAN_HOST: "192.168.1.50",
    });
  });

  test("omits OBSIDIAN_DISABLED_TOOLS when extraEnv is undefined", async () => {
    // This is the default-install path: no disabled list configured,
    // so only OBSIDIAN_API_KEY is written. The env block must not
    // contain leftover keys from a previous undefined/empty state.
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    const env = content.mcpServers["obsidian-mcp-tools"].env;
    expect(env).toEqual({ OBSIDIAN_API_KEY: "test-api-key" });
    expect("OBSIDIAN_DISABLED_TOOLS" in env).toBe(false);
  });

  test("overwrites the previous obsidian-mcp-tools entry on repeat install", async () => {
    // Simulate a reinstall where the old entry has stale env values
    // that should be fully replaced, not merged onto.
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "obsidian-mcp-tools": {
            command: "/old/path/to/mcp-server",
            env: {
              OBSIDIAN_API_KEY: "old-key",
              OBSIDIAN_DISABLED_TOOLS: "stale_tool",
            },
          },
        },
      }),
    );

    await updateClaudeConfig(
      null,
      "/new/path/to/mcp-server",
      "new-key",
    );

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    const entry = content.mcpServers["obsidian-mcp-tools"];
    expect(entry.command).toBe("/new/path/to/mcp-server");
    // The stale OBSIDIAN_DISABLED_TOOLS must be gone — not carried
    // over from the previous install.
    expect(entry.env).toEqual({ OBSIDIAN_API_KEY: "new-key" });
  });

  test("writes valid JSON that round-trips through JSON.parse", async () => {
    // Defense in depth: guarantee the output is not just human-
    // readable but parseable — catches accidental JSON.stringify
    // replacer misuse or encoding drift.
    await updateClaudeConfig(
      null,
      "/abs/path/to/mcp-server",
      "test-api-key",
      { OBSIDIAN_DISABLED_TOOLS: "a, b" },
    );

    const raw = await fsp.readFile(configPath, "utf8");
    expect(() => JSON.parse(raw)).not.toThrow();
    // The file is pretty-printed with 2-space indent per the
    // implementation's `JSON.stringify(..., null, 2)` call — spot-
    // check by looking for a newline in the output.
    expect(raw).toContain("\n");
  });
});

describe("removeFromClaudeConfig", () => {
  if (os.platform() !== "darwin") {
    test.skip("removeFromClaudeConfig tests run only on macOS", () => {});
    return;
  }

  let tmpRoot: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-config-remove-test-"),
    );
    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("removes the obsidian-mcp-tools entry and keeps others intact", async () => {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          "obsidian-mcp-tools": {
            command: "/old/path",
            env: { OBSIDIAN_API_KEY: "key" },
          },
          "some-other-server": {
            command: "/usr/bin/other",
          },
        },
      }),
    );

    await removeFromClaudeConfig();

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect("obsidian-mcp-tools" in content.mcpServers).toBe(false);
    expect(content.mcpServers["some-other-server"]).toEqual({
      command: "/usr/bin/other",
    });
  });

  test("is a no-op when the config file does not exist", async () => {
    // A user who never ran "Install Server" uninstalls the plugin —
    // there is nothing to remove. The call must not throw.
    await expect(removeFromClaudeConfig()).resolves.toBeUndefined();
  });

  test("is a no-op when our entry is absent from an otherwise valid config", async () => {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    const originalContent = {
      mcpServers: {
        "some-other-server": { command: "/usr/bin/other" },
      },
    };
    await fsp.writeFile(configPath, JSON.stringify(originalContent));

    await removeFromClaudeConfig();

    // The file should still exist with the same unrelated entry.
    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(content).toEqual(originalContent);
  });
});
