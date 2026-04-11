import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import fsp from "fs/promises";
import os from "os";
import path from "path";
import {
  ARCH_TYPES,
  GITHUB_DOWNLOAD_URL,
  PLATFORM_TYPES,
} from "../constants";
import {
  ensureDirectory,
  getArch,
  getDownloadUrl,
  getPlatform,
  isArch,
  isPlatform,
} from "./install";

describe("getDownloadUrl", () => {
  test("returns the linux URL without arch suffix", () => {
    // Linux only ships a single binary (no -x64 / -arm64 variant in
    // the release assets), by design — see the inline comment in
    // getDownloadUrl and issue #26 (WSL selection).
    expect(getDownloadUrl("linux", "x64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-linux`,
    );
    expect(getDownloadUrl("linux", "arm64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-linux`,
    );
  });

  test("returns the macOS URL with the arch embedded", () => {
    expect(getDownloadUrl("macos", "x64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-macos-x64`,
    );
    expect(getDownloadUrl("macos", "arm64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-macos-arm64`,
    );
  });

  test("returns the Windows URL with .exe extension and no arch", () => {
    // Windows release ships a single `.exe` regardless of arch.
    expect(getDownloadUrl("windows", "x64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-windows.exe`,
    );
    expect(getDownloadUrl("windows", "arm64")).toBe(
      `${GITHUB_DOWNLOAD_URL}/mcp-server-windows.exe`,
    );
  });

  test("always produces an absolute HTTPS URL", () => {
    // Defense in depth: the Release URL must be HTTPS so the
    // self-signed-cert bypass used elsewhere in the server does not
    // accidentally weaken the binary download integrity.
    for (const platform of PLATFORM_TYPES) {
      for (const arch of ARCH_TYPES) {
        const url = getDownloadUrl(platform, arch);
        expect(url.startsWith("https://")).toBe(true);
      }
    }
  });
});

describe("getPlatform", () => {
  // Clean up any test-set env var so tests don't leak state into
  // the rest of the suite.
  afterEach(() => {
    delete process.env.OBSIDIAN_SERVER_PLATFORM;
  });

  test("returns one of the supported Platform literals for the current OS", () => {
    // Smoke test: the runtime platform must map to a value that
    // BINARY_NAME and CLAUDE_CONFIG_PATH both know about. Anything
    // else would fall into the `default` branch which returns
    // "linux" — we accept that as the fallback but still want to
    // assert the result is a valid Platform union member.
    const result = getPlatform();
    expect(PLATFORM_TYPES).toContain(result);
  });

  test("honors an explicit override argument", () => {
    // Priority 1: when the plugin passes an override (read from the
    // user's `platformOverride` setting), it wins over both env var
    // and auto-detect. Also covers the round-trip for every literal.
    for (const platform of PLATFORM_TYPES) {
      expect(getPlatform(platform)).toBe(platform);
    }
  });

  test("honors OBSIDIAN_SERVER_PLATFORM env var when no override is passed", () => {
    // Priority 2: env var as escape hatch for WSL / Bottles / wine
    // scenarios where the user cannot easily toggle a plugin setting.
    process.env.OBSIDIAN_SERVER_PLATFORM = "linux";
    expect(getPlatform()).toBe("linux");

    process.env.OBSIDIAN_SERVER_PLATFORM = "windows";
    expect(getPlatform()).toBe("windows");

    process.env.OBSIDIAN_SERVER_PLATFORM = "macos";
    expect(getPlatform()).toBe("macos");
  });

  test("explicit override wins over OBSIDIAN_SERVER_PLATFORM env var", () => {
    // If both are set, the explicit setting (plugin UI) beats the
    // env var. This mirrors the priority chain documented on the
    // getPlatform JSDoc.
    process.env.OBSIDIAN_SERVER_PLATFORM = "windows";
    expect(getPlatform("linux")).toBe("linux");
  });

  test("falls through to auto-detect when override is invalid", () => {
    // A typo in the env var should not crash — it should silently
    // degrade to the auto-detected platform, same as if the env var
    // were unset.
    process.env.OBSIDIAN_SERVER_PLATFORM = "not-a-platform";
    const result = getPlatform();
    expect(PLATFORM_TYPES).toContain(result);
  });

  test("ignores an explicit override that is not a valid Platform", () => {
    // Defense in depth: even if a misbehaving caller passes a bogus
    // string via the override argument (e.g. untyped JSON from
    // plugin settings), the function must not return that string.
    // We cast through `unknown` to simulate the lax-typing scenario.
    const bogus = "bsd" as unknown as Parameters<typeof getPlatform>[0];
    const result = getPlatform(bogus);
    expect(PLATFORM_TYPES).toContain(result);
  });
});

describe("getArch", () => {
  afterEach(() => {
    delete process.env.OBSIDIAN_SERVER_ARCH;
  });

  test("returns an Arch literal matching the current process", () => {
    // os.arch() can return values like "ia32", "ppc64", etc., which
    // the codebase does not currently support. This test documents
    // that assumption: if you run the suite on an unsupported arch,
    // the assertion fails and flags the gap explicitly.
    const result = getArch();
    expect(ARCH_TYPES).toContain(result);
  });

  test("honors an explicit override argument", () => {
    for (const arch of ARCH_TYPES) {
      expect(getArch(arch)).toBe(arch);
    }
  });

  test("honors OBSIDIAN_SERVER_ARCH env var when no override is passed", () => {
    process.env.OBSIDIAN_SERVER_ARCH = "arm64";
    expect(getArch()).toBe("arm64");

    process.env.OBSIDIAN_SERVER_ARCH = "x64";
    expect(getArch()).toBe("x64");
  });

  test("falls through to auto-detect when env var is invalid", () => {
    process.env.OBSIDIAN_SERVER_ARCH = "ppc64";
    const result = getArch();
    expect(ARCH_TYPES).toContain(result);
  });
});

describe("isPlatform / isArch", () => {
  test("isPlatform accepts only the supported Platform literals", () => {
    for (const platform of PLATFORM_TYPES) {
      expect(isPlatform(platform)).toBe(true);
    }
    expect(isPlatform("bsd")).toBe(false);
    expect(isPlatform("")).toBe(false);
    expect(isPlatform(undefined)).toBe(false);
    expect(isPlatform(null)).toBe(false);
    expect(isPlatform(42)).toBe(false);
  });

  test("isArch accepts only the supported Arch literals", () => {
    for (const arch of ARCH_TYPES) {
      expect(isArch(arch)).toBe(true);
    }
    expect(isArch("ia32")).toBe(false);
    expect(isArch("")).toBe(false);
    expect(isArch(undefined)).toBe(false);
  });
});

describe("ensureDirectory", () => {
  let tmpRoot: string;

  beforeEach(async () => {
    tmpRoot = await fsp.mkdtemp(
      path.join(os.tmpdir(), "mcp-tools-ensure-dir-test-"),
    );
  });

  afterEach(async () => {
    await fsp.rm(tmpRoot, { recursive: true, force: true });
  });

  test("creates the directory when it does not exist", async () => {
    const target = path.join(tmpRoot, "new-dir");
    await expect(fsp.access(target)).rejects.toThrow();

    await ensureDirectory(target);

    const stat = await fsp.stat(target);
    expect(stat.isDirectory()).toBe(true);
  });

  test("creates nested directories recursively", async () => {
    // The installer creates `.obsidian/plugins/<id>/bin/` which is
    // typically 2+ levels deep from any mkdir checkpoint, so we must
    // support recursive creation.
    const target = path.join(tmpRoot, "a", "b", "c", "deep");

    await ensureDirectory(target);

    const stat = await fsp.stat(target);
    expect(stat.isDirectory()).toBe(true);
  });

  test("is a no-op when the directory already exists and is writable", async () => {
    const target = path.join(tmpRoot, "existing");
    await fsp.mkdir(target);
    // Write a sentinel file inside; ensureDirectory must not touch it.
    const sentinel = path.join(target, "do-not-delete.txt");
    await fsp.writeFile(sentinel, "preserved");

    await ensureDirectory(target);

    expect(await fsp.readFile(sentinel, "utf8")).toBe("preserved");
  });

  test("throws a descriptive error when the path exists but is not writable", async () => {
    // Simulate a read-only directory by chmod'ing it to 0o555. This
    // test is Unix-specific because Windows ignores Unix file modes.
    if (os.platform() === "win32") {
      // Skip on Windows — chmod semantics don't match.
      return;
    }
    // Also skip when running as root: root bypasses POSIX permission
    // checks and would make the "not writable" assertion pass when
    // the intent of the test is to catch a real permission denial.
    if (process.getuid && process.getuid() === 0) {
      return;
    }

    const target = path.join(tmpRoot, "readonly");
    await fsp.mkdir(target);
    await fsp.chmod(target, 0o555);

    try {
      await expect(ensureDirectory(target)).rejects.toThrow(
        /not writable/,
      );
    } finally {
      // Restore write permission so afterEach cleanup can rm the dir.
      await fsp.chmod(target, 0o755);
    }
  });
});
