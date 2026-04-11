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
import { FileSystemAdapter } from "obsidian";
import { uninstallServer } from "./uninstall";

/**
 * Integration tests for uninstallServer.
 *
 * Strategy: real tmpdir as the vault root + `spyOn(os, "homedir")`
 * to relocate Claude Desktop's config file into the sandbox.
 * uninstall.ts now shares `getConfigPath()` with config.ts, which
 * uses `os.homedir()` under the hood — matching config.test.ts's
 * approach (Bun/Node cache HOME early, so an env var override is
 * not reliable once the process has initialized).
 *
 * Platform scope: tests run only on macOS because `getConfigPath()`
 * branches on `os.platform()`, and the macOS branch is what this
 * project's primary users hit. The Linux branch now shares the same
 * code path thanks to the cross-platform config fix, but exercising
 * it would require `spyOn(os, "platform")` which bun:test does not
 * support cleanly for ESM-imported `os`.
 */

describe("uninstallServer", () => {
  if (os.platform() !== "darwin") {
    test.skip("uninstallServer tests run only on macOS today", () => {});
    return;
  }

  let tmpRoot: string;
  let binDir: string;
  let binaryPath: string;
  let configPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  const PLUGIN_ID = "obsidian-mcp-tools";

  function makeFakePlugin() {
    const adapter = new FileSystemAdapter(tmpRoot);
    return {
      manifest: { id: PLUGIN_ID, version: "0.2.27" },
      app: {
        vault: {
          configDir: ".obsidian",
          adapter,
        },
      },
      // uninstallServer now calls plugin.loadData() to read the
      // platformOverride setting. The default fake returns an empty
      // settings object so uninstall uses the auto-detected platform.
      loadData: async () => ({}),
    };
  }

  beforeEach(async () => {
    const rawTmp = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-uninstall-test-"),
    );
    tmpRoot = await fsp.realpath(rawTmp);
    binDir = path.join(tmpRoot, ".obsidian", "plugins", PLUGIN_ID, "bin");
    binaryPath = path.join(binDir, "mcp-server");
    configPath = path.join(
      tmpRoot,
      "Library/Application Support/Claude/claude_desktop_config.json",
    );

    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("removes an existing binary from the bin dir", async () => {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(binaryPath, "#!/bin/sh\necho ok\n", { mode: 0o755 });

    await uninstallServer(makeFakePlugin() as never);

    await expect(fsp.access(binaryPath)).rejects.toThrow();
  });

  test("removes the empty bin directory after deleting the binary", async () => {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(binaryPath, "#!/bin/sh\necho ok\n", { mode: 0o755 });

    await uninstallServer(makeFakePlugin() as never);

    await expect(fsp.access(binDir)).rejects.toThrow();
  });

  test("is a no-op when the binary file is already absent", async () => {
    // User uninstalls before ever installing. Calling uninstall on a
    // pristine vault must not throw — the UI uses this flow to reset
    // state after a failed install.
    await expect(
      uninstallServer(makeFakePlugin() as never),
    ).resolves.toBeUndefined();
  });

  test("leaves a non-empty bin dir intact when an unrelated file is present", async () => {
    // If another tool has dropped a file in the bin directory (e.g.
    // a user drop-in script), uninstall must not cascade-delete it.
    // The current implementation catches ENOTEMPTY and moves on.
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(binaryPath, "#!/bin/sh\necho ok\n", { mode: 0o755 });
    const sidecarPath = path.join(binDir, "user-sidecar.txt");
    await fsp.writeFile(sidecarPath, "user data, do not touch");

    await uninstallServer(makeFakePlugin() as never);

    // Our binary is gone:
    await expect(fsp.access(binaryPath)).rejects.toThrow();
    // The bin dir still exists:
    const dirStat = await fsp.stat(binDir);
    expect(dirStat.isDirectory()).toBe(true);
    // The sidecar file is untouched:
    expect(await fsp.readFile(sidecarPath, "utf8")).toBe(
      "user data, do not touch",
    );
  });

  test("removes the obsidian-mcp-tools entry from Claude Desktop config", async () => {
    await fsp.mkdir(path.dirname(configPath), { recursive: true });
    await fsp.writeFile(
      configPath,
      JSON.stringify({
        mcpServers: {
          [PLUGIN_ID]: {
            command: "/old/path",
            env: { OBSIDIAN_API_KEY: "key" },
          },
          "some-other-server": {
            command: "/usr/bin/other",
          },
        },
      }),
    );

    await uninstallServer(makeFakePlugin() as never);

    const content = JSON.parse(await fsp.readFile(configPath, "utf8"));
    expect(PLUGIN_ID in content.mcpServers).toBe(false);
    // Other servers must survive — same invariant as
    // removeFromClaudeConfig in config.test.ts.
    expect(content.mcpServers["some-other-server"]).toEqual({
      command: "/usr/bin/other",
    });
  });

  test("is a no-op on the Claude config when the file does not exist", async () => {
    // The uninstall must tolerate a user who never ran Install Server
    // (or who already cleaned up the config manually).
    await expect(
      uninstallServer(makeFakePlugin() as never),
    ).resolves.toBeUndefined();
  });
});
