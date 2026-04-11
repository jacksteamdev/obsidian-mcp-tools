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
import { INSTALL_PATH } from "../constants";
import type { InstallationStatus } from "../types";
import {
  detectLegacyVaultBinary,
  getInstallationStatus,
  getInstallPath,
} from "./status";

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
    installLocation?: "vault" | "system" | undefined;
  } = {}) {
    const adapter = new FileSystemAdapter(tmpRoot);
    // Distinguish "apiKey omitted (use default)" from "apiKey
    // explicitly set to undefined" — the latter is how the test
    // simulates the "no api key" state. Using `overrides.apiKey ??
    // "fake-api-key"` would collapse both into a truthy value.
    const apiKey =
      "apiKey" in overrides ? overrides.apiKey : "fake-api-key";
    // Default: `"vault"`. The existing 9 tests were written before
    // issue #28 added a system-path default — they all probe the
    // vault install layout, so `makeFakePlugin()` without an
    // override must keep threading the vault location through
    // `plugin.loadData()`. Tests that explicitly want the new
    // system-path default pass `installLocation: undefined`;
    // tests that want the explicit "system" marker pass
    // `"system"`.
    const installLocation =
      "installLocation" in overrides ? overrides.installLocation : "vault";
    // Build the settings payload with the same "respect
    // explicitly-undefined" semantics as apiKey so the undefined
    // default branch is reachable from a test.
    const data: { installLocation?: "vault" | "system" } = {};
    if (installLocation !== undefined) {
      data.installLocation = installLocation;
    }
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
      // getInstallPath / status.ts now read `platformOverride` and
      // `installLocation` from plugin.loadData() to honor the
      // user's setting. The default fake plugin returns a settings
      // object with `installLocation: "vault"` so the existing
      // legacy-layout tests keep passing.
      loadData: async () => data,
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

/**
 * Tests for the `installLocation` setting (issue #28).
 *
 * Covers the four reachable combinations of the new setting:
 *
 *   - `"vault"` + binary present in the vault → installed
 *   - `"system"` + binary present at the system path → installed
 *   - `undefined` (the new default) + no binary → not installed,
 *     but `status.path` still points at the system location as a
 *     regression guard for the new default
 *   - `undefined` + binary at the system path → installed
 *
 * The system-path tests use `spyOn(os, "homedir")` to redirect the
 * expanded INSTALL_PATH into the test's tmpdir. Bun/Node cache
 * HOME early so a `process.env.HOME =` override is not reliable —
 * see config.test.ts and uninstall.test.ts for the same pattern.
 */
describe("getInstallationStatus with installLocation setting", () => {
  if (os.platform() !== "darwin") {
    test.skip("installLocation integration tests run only on macOS today", () => {});
    return;
  }

  let tmpRoot: string;
  let vaultBinDir: string;
  let vaultBinaryPath: string;
  let systemBinDir: string;
  let systemBinaryPath: string;
  let homedirSpy: Mock<typeof os.homedir>;

  const PLUGIN_ID = "obsidian-mcp-tools";

  function makeFakePlugin(overrides: {
    version?: string;
    installLocation?: "vault" | "system" | undefined;
  } = {}) {
    const adapter = new FileSystemAdapter(tmpRoot);
    // Intentionally let `installLocation` pass through as-is,
    // INCLUDING explicit `undefined`, so tests can reach the new
    // system-path default branch. Absence of the key in
    // `overrides` also means undefined — both paths are covered.
    const data: { installLocation?: "vault" | "system" } = {};
    if (
      "installLocation" in overrides &&
      overrides.installLocation !== undefined
    ) {
      data.installLocation = overrides.installLocation;
    }
    return {
      manifest: { id: PLUGIN_ID, version: overrides.version ?? "0.2.27" },
      app: {
        vault: {
          configDir: ".obsidian",
          adapter,
        },
      },
      getLocalRestApiKey: () => "fake-api-key",
      loadData: async () => data,
    };
  }

  beforeEach(async () => {
    const rawTmp = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-installloc-test-"),
    );
    tmpRoot = await fsp.realpath(rawTmp);
    vaultBinDir = path.join(
      tmpRoot,
      ".obsidian",
      "plugins",
      PLUGIN_ID,
      "bin",
    );
    vaultBinaryPath = path.join(vaultBinDir, "mcp-server");
    // INSTALL_PATH.macos starts with `~/Library/Application Support/…`.
    // With os.homedir() stubbed to tmpRoot, the expanded path
    // lives at tmpRoot/Library/Application Support/….
    systemBinDir = path.join(
      tmpRoot,
      "Library",
      "Application Support",
      "obsidian-mcp-tools",
      "bin",
    );
    systemBinaryPath = path.join(systemBinDir, "mcp-server");

    homedirSpy = spyOn(os, "homedir").mockReturnValue(tmpRoot);
  });

  afterEach(async () => {
    homedirSpy.mockRestore();
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  async function writeFakeBinaryAt(target: string, version: string) {
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(
      target,
      `#!/bin/sh\necho "${version}"\n`,
      { mode: 0o755 },
    );
  }

  test("installLocation: 'vault' + binary in vault → 'installed'", async () => {
    await writeFakeBinaryAt(vaultBinaryPath, "0.2.27");
    const plugin = makeFakePlugin({ installLocation: "vault" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.path).toBe(vaultBinaryPath);
    expect(status.versions.server).toBe("0.2.27");
  });

  test("installLocation: 'system' + binary at expanded system path → 'installed'", async () => {
    await writeFakeBinaryAt(systemBinaryPath, "0.2.27");
    const plugin = makeFakePlugin({ installLocation: "system" });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.path).toBe(systemBinaryPath);
    expect(status.versions.server).toBe("0.2.27");
  });

  test("installLocation: undefined (new default) + no binary → 'not installed' with system path", async () => {
    // Key regression guard for the new default (issue #28). Even
    // when nothing is installed, the computed install path must
    // point at the system location — otherwise a freshly-installed
    // user would see the UI proposing a vault-path install when
    // the current default is supposed to be system.
    const plugin = makeFakePlugin({ installLocation: undefined });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("not installed");
    expect(status.path).toBe(systemBinaryPath);
    // Expanded INSTALL_PATH.macos starts with `{tmpRoot}/Library`
    // once os.homedir() is stubbed. This guard catches regressions
    // in `expandHomePath` that would leave the literal `~` in place.
    expect(status.path?.startsWith(tmpRoot)).toBe(true);
    expect(status.path).not.toContain("~");
  });

  test("installLocation: undefined (new default) + binary at system path → 'installed'", async () => {
    // Proves the `undefined → "system"` default reaches the same
    // expanded system path as the explicit `"system"` setting.
    await writeFakeBinaryAt(systemBinaryPath, "0.2.27");
    const plugin = makeFakePlugin({ installLocation: undefined });

    const status = await getInstallationStatus(plugin as never);

    expect(status.state).toBe("installed");
    expect(status.path).toBe(systemBinaryPath);
    expect(status.versions.server).toBe("0.2.27");
  });

  test("getInstallPath (direct) returns the expanded system dir for the new default", async () => {
    // Calling getInstallPath directly lets us assert on the dir
    // field without routing through the state machine. Double-
    // checks that INSTALL_PATH.macos was expanded with the stubbed
    // homedir and that no symlink resolution happened on the
    // system-path branch (no file exists — realpath would ENOENT).
    const plugin = makeFakePlugin({ installLocation: undefined });

    const info = await getInstallPath(plugin as never);

    if ("error" in info) {
      throw new Error(`Expected InstallPathInfo, got error: ${info.error}`);
    }
    expect(info.dir).toBe(systemBinDir);
    expect(info.path).toBe(systemBinaryPath);
    expect(info.name).toBe("mcp-server");
    // System-path branch skips realpath, so `symlinked` is always
    // undefined regardless of the on-disk state of the directory.
    expect(info.symlinked).toBeUndefined();
    // Spot-check that INSTALL_PATH.macos was the template used —
    // guards against accidental drift between the two constants.
    expect(info.dir).toContain("Library/Application Support");
    expect(INSTALL_PATH.macos).toContain("Library/Application Support");
  });
});

describe("detectLegacyVaultBinary", () => {
  if (os.platform() === "win32") {
    test.skip("detectLegacyVaultBinary tests are Unix-only", () => {});
    return;
  }

  let tmpRoot: string;
  let binDir: string;
  let binaryPath: string;

  const PLUGIN_ID = "obsidian-mcp-tools";

  function makeFakePlugin(overrides: {
    installLocation?: "vault" | "system" | undefined;
  } = {}) {
    const adapter = new FileSystemAdapter(tmpRoot);
    const data: { installLocation?: "vault" | "system" } = {};
    if (
      "installLocation" in overrides &&
      overrides.installLocation !== undefined
    ) {
      data.installLocation = overrides.installLocation;
    }
    return {
      manifest: { id: PLUGIN_ID, version: "0.2.27" },
      app: {
        vault: {
          configDir: ".obsidian",
          adapter,
        },
      },
      getLocalRestApiKey: () => "fake-api-key",
      loadData: async () => data,
    };
  }

  beforeEach(async () => {
    const rawTmp = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-detect-legacy-test-"),
    );
    tmpRoot = await fsp.realpath(rawTmp);
    binDir = path.join(tmpRoot, ".obsidian", "plugins", PLUGIN_ID, "bin");
    binaryPath = path.join(binDir, "mcp-server");
  });

  afterEach(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  async function writeVaultBinary(scriptBody: string, mode = 0o755) {
    await fsp.mkdir(binDir, { recursive: true });
    await fsp.writeFile(binaryPath, scriptBody, { mode });
  }

  test("returns { path, version } when a vault binary prints a valid version", async () => {
    await writeVaultBinary(`#!/bin/sh\necho "0.2.27"\n`);
    const plugin = makeFakePlugin();

    const result = await detectLegacyVaultBinary(plugin as never);

    expect(result).not.toBeNull();
    expect(result?.path).toBe(binaryPath);
    expect(result?.version).toBe("0.2.27");
  });

  test("returns { path, version: undefined } when the binary exits non-zero", async () => {
    // A user may have a corrupted or platform-mismatched binary
    // sitting in the vault. We still want the UI to show the
    // migration banner — the point of the migration is to
    // REPLACE a broken state with a known-good one.
    await writeVaultBinary(`#!/bin/sh\nexit 1\n`);
    const plugin = makeFakePlugin();

    const result = await detectLegacyVaultBinary(plugin as never);

    expect(result).not.toBeNull();
    expect(result?.path).toBe(binaryPath);
    expect(result?.version).toBeUndefined();
  });

  test("returns null when the bin dir does not exist", async () => {
    const plugin = makeFakePlugin();

    const result = await detectLegacyVaultBinary(plugin as never);

    expect(result).toBeNull();
  });

  test("returns null when the binary exists but is not executable", async () => {
    // X_OK is the right check — a readable-but-non-executable
    // file is not something installMcpServer would ever have
    // written (the download stream chmods to 0o755), so its
    // presence is a corrupted state that should not trigger the
    // migration banner.
    await writeVaultBinary(`#!/bin/sh\necho "0.2.27"\n`, 0o644);
    const plugin = makeFakePlugin();

    const result = await detectLegacyVaultBinary(plugin as never);

    expect(result).toBeNull();
  });

  test("returns the vault binary even when installLocation is set to 'system'", async () => {
    // This is the critical invariant for the UI's migration
    // banner: the banner must appear whenever a legacy binary is
    // ON DISK, independent of the user's CURRENT setting. Without
    // this, a user who flipped `installLocation` to `"system"`
    // before ever running the migration would never be offered
    // the cleanup path.
    await writeVaultBinary(`#!/bin/sh\necho "0.2.27"\n`);
    const plugin = makeFakePlugin({ installLocation: "system" });

    const result = await detectLegacyVaultBinary(plugin as never);

    expect(result).not.toBeNull();
    expect(result?.path).toBe(binaryPath);
    expect(result?.version).toBe("0.2.27");
  });
});
