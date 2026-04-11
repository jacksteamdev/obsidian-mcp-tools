import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import { FileSystemAdapter } from "obsidian";
import type { InstallationStatus } from "../types";
import { getInstallationStatus } from "./status";

/**
 * State-machine integration tests for getInstallationStatus.
 *
 * Rather than mocking `child_process.exec`, these tests write a real
 * shell script to the expected binary path and let the production
 * code invoke it. This keeps the test one step closer to reality: if
 * the actual `execAsync` flow stops parsing stdout correctly, the
 * test catches it. The downside is that the tests are Unix-only
 * (#!/bin/sh shebang). config.test.ts is already macOS-guarded for
 * the same reason; we apply the same guard here.
 *
 * The fake plugin is a plain object cast to any — we rely on duck
 * typing for the subset of McpToolsPlugin that status.ts actually
 * reaches: manifest.id, manifest.version, app.vault.configDir,
 * app.vault.adapter (must be a FileSystemAdapter instance so the
 * production `getFileSystemAdapter` helper's instanceof check
 * passes), and getLocalRestApiKey().
 */

describe("getInstallationStatus", () => {
  if (os.platform() === "win32") {
    test.skip("getInstallationStatus integration tests are Unix-only", () => {});
    return;
  }

  let tmpRoot: string;
  let binDir: string;
  let binaryPath: string;

  const PLUGIN_ID = "obsidian-mcp-tools";

  function makeFakePlugin(overrides: {
    version?: string;
    apiKey?: string | undefined;
  } = {}) {
    const adapter = new FileSystemAdapter(tmpRoot);
    // Distinguish "apiKey omitted (use default)" from "apiKey
    // explicitly set to undefined" — the latter is how the test
    // simulates the "no api key" state. Using `overrides.apiKey ??
    // "fake-api-key"` would collapse both into a truthy value.
    const apiKey =
      "apiKey" in overrides ? overrides.apiKey : "fake-api-key";
    return {
      manifest: { id: PLUGIN_ID, version: overrides.version ?? "0.2.27" },
      app: {
        vault: {
          configDir: ".obsidian",
          adapter,
        },
      },
      // Production code calls this synchronously in status.ts (without
      // await) and only checks truthiness. Keeping it sync here is
      // intentional: it matches how getInstallationStatus reads it.
      getLocalRestApiKey: () => apiKey,
    };
  }

  beforeEach(async () => {
    // Resolve the symlink chain up front. On macOS, os.tmpdir() returns
    // `/var/folders/...` but the production code calls `fsp.realpath`
    // which resolves it to `/private/var/folders/...`. If we keep
    // tmpRoot as the raw mkdtemp result, every `expect(status.path)`
    // assertion fails with a /var vs /private/var mismatch.
    const rawTmp = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-status-test-"),
    );
    tmpRoot = await fsp.realpath(rawTmp);
    binDir = path.join(tmpRoot, ".obsidian", "plugins", PLUGIN_ID, "bin");
    binaryPath = path.join(binDir, "mcp-server");
  });

  afterEach(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  /**
   * Helper: writes an executable shell script at the expected binary
   * path that prints the given version string when invoked with any
   * arguments (status.ts calls it with `--version`).
   */
  async function writeFakeBinary(version: string) {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(
      binaryPath,
      `#!/bin/sh\necho "${version}"\n`,
      { mode: 0o755 },
    );
  }

  test("returns 'no api key' when getLocalRestApiKey is falsy", async () => {
    const plugin = makeFakePlugin({ apiKey: undefined });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("no api key");
    expect(status.versions.plugin).toBe("0.2.27");
  });

  test("returns 'error' when the plugin manifest version is invalid semver", async () => {
    const plugin = makeFakePlugin({ version: "not-a-version" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("error");
    // No plugin version should be reported because the sanitized value
    // was null — the error precedes the api-key check.
    expect(status.versions.plugin).toBeUndefined();
  });

  test("returns 'not installed' when the binary is missing", async () => {
    const plugin = makeFakePlugin();

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("not installed");
    expect(status.versions.plugin).toBe("0.2.27");
    // The computed install path should still be present so the UI
    // can offer an "Install" button pointing at the right location.
    // Regression guard for the slash-stripping bug: status.ts used
    // to return a relative-looking path here because the ENOENT
    // fallback branch recomposed segments with `path.join("", ...)`.
    expect(status.path).toBe(binaryPath);
    expect(status.path?.startsWith(path.sep)).toBe(true);
  });

  test("returns 'installed' when the binary reports the matching version", async () => {
    await writeFakeBinary("0.2.27");
    const plugin = makeFakePlugin({ version: "0.2.27" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.versions.plugin).toBe("0.2.27");
    expect(status.versions.server).toBe("0.2.27");
  });

  test("returns 'outdated' when the binary version is older than the plugin version", async () => {
    await writeFakeBinary("0.2.20");
    const plugin = makeFakePlugin({ version: "0.2.27" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("outdated");
    expect(status.versions.plugin).toBe("0.2.27");
    expect(status.versions.server).toBe("0.2.20");
  });

  test("returns 'installed' when the binary version is newer than the plugin version", async () => {
    // status.ts only treats `serverVersion < pluginVersion` as outdated;
    // anything else (equal or newer) is considered installed. This pins
    // that semantics — if a future refactor flips the comparison, this
    // test will fail loudly instead of silently marking a newer binary
    // as 'installed' by accident.
    await writeFakeBinary("0.3.0");
    const plugin = makeFakePlugin({ version: "0.2.27" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.versions.server).toBe("0.3.0");
  });

  test("returns 'error' when the binary exists but --version output is not valid semver", async () => {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(
      binaryPath,
      `#!/bin/sh\necho "garbage not a version"\n`,
      { mode: 0o755 },
    );
    const plugin = makeFakePlugin();

    const status: InstallationStatus = await getInstallationStatus(
      plugin as never,
    );

    expect(status.state).toBe("error");
    expect(status.versions.plugin).toBe("0.2.27");
    // Server version stays unset because we never got a clean value.
    expect(status.versions.server).toBeUndefined();
  });

  test("returns 'error' when the binary exits non-zero on --version", async () => {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(binaryPath, `#!/bin/sh\nexit 1\n`, { mode: 0o755 });
    const plugin = makeFakePlugin();

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("error");
  });

  test("tolerates v-prefixed version output (common release tag format)", async () => {
    // semver.clean() strips a leading `v`, so `v0.2.27` is a valid
    // response from the binary. This test pins that behavior.
    await writeFakeBinary("v0.2.27");
    const plugin = makeFakePlugin({ version: "0.2.27" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.versions.server).toBe("0.2.27");
  });
});
