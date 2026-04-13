/**
 * BDD specs for getLogFilePath — platform-specific branches.
 *
 * These tests use Bun's mock.module to simulate different OS platforms,
 * covering the win32, linux, and unsupported-platform branches that are
 * unreachable on the native test platform.
 */

import { describe, expect, mock, test } from "bun:test";
import { homedir } from "os";
import { resolve } from "path";

/**
 * REQUIREMENT: getLogFilePath returns the correct OS-conventional log path
 *              for each supported platform and throws for unsupported ones.
 *
 * WHO: Any consumer that needs to locate log files on the filesystem
 * WHAT: 1. On win32, returns ~/AppData/Local/Logs/<appName>/<fileName>
 *       2. On linux, returns ~/.local/share/logs/<appName>/<fileName>
 *       3. On unsupported platforms, throws an error
 * WHY: Log files must be written to OS-conventional locations; writing to
 *      the wrong directory makes logs unfindable for users and support tools
 *
 * MOCK BOUNDARY:
 *     Mock:  os.platform() — process-level environment state
 *     Real:  getLogFilePath, os.homedir(), path.resolve()
 *     Never: mock getLogFilePath itself or path resolution
 */
describe("getLogFilePath — platform-specific paths", () => {
  test("returns Windows-style path on win32", async () => {
    /**
     * Given the OS platform is win32
     * When getLogFilePath is called
     * Then the returned path follows Windows conventions (AppData/Local/Logs)
     */

    // Given: platform is mocked to win32
    mock.module("os", () => ({
      platform: () => "win32",
      homedir,
    }));
    const { getLogFilePath } = await import("./logger");

    // When: the log file path is resolved
    const result = getLogFilePath("test-app", "test.log");

    // Then: the path follows Windows conventions
    const expected = resolve(homedir(), "AppData", "Local", "Logs", "test-app", "test.log");
    expect(result).toBe(expected);
  });

  test("returns Linux-style path on linux", async () => {
    /**
     * Given the OS platform is linux
     * When getLogFilePath is called
     * Then the returned path follows Linux conventions (.local/share/logs)
     */

    // Given: platform is mocked to linux
    mock.module("os", () => ({
      platform: () => "linux",
      homedir,
    }));
    const { getLogFilePath } = await import("./logger");

    // When: the log file path is resolved
    const result = getLogFilePath("test-app", "test.log");

    // Then: the path follows Linux conventions
    const expected = resolve(homedir(), ".local", "share", "logs", "test-app", "test.log");
    expect(result).toBe(expected);
  });

  test("throws for unsupported platforms", async () => {
    /**
     * Given the OS platform is an unsupported value
     * When getLogFilePath is called
     * Then it throws an error indicating the platform is unsupported
     */

    // Given: platform is mocked to an unsupported value
    mock.module("os", () => ({
      platform: () => "freebsd",
      homedir,
    }));
    const { getLogFilePath } = await import("./logger");

    // When/Then: calling getLogFilePath throws
    expect(() => getLogFilePath("test-app", "test.log")).toThrow(
      "Unsupported operating system",
    );
  });
});
