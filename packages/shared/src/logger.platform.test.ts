/**
 * BDD specs for getLogFilePath — platform-specific branches.
 *
 * These tests exercise the win32, linux, and unsupported-platform branches
 * via the _platform parameter override, avoiding mock.module which leaks
 * across test files in Bun's single-process CLI runner.
 */

import { describe, expect, test } from "bun:test";
import { homedir } from "os";
import { resolve } from "path";
import { getLogFilePath } from "./logger";

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
 *     Mock:  nothing — uses the _platform parameter override
 *     Real:  getLogFilePath, os.homedir(), path.resolve()
 *     Never: mock.module("os") — leaks across files in Bun CLI runner
 */
describe("getLogFilePath — platform-specific paths", () => {
  test("returns Windows-style path on win32", () => {
    /**
     * Given the OS platform is win32
     * When getLogFilePath is called with _platform="win32"
     * Then the returned path follows Windows conventions (AppData/Local/Logs)
     */

    // Given: platform override is win32

    // When: the log file path is resolved
    const result = getLogFilePath("test-app", "test.log", "win32");

    // Then: the path follows Windows conventions
    const expected = resolve(homedir(), "AppData", "Local", "Logs", "test-app", "test.log");
    expect(result).toBe(expected);
  });

  test("returns Linux-style path on linux", () => {
    /**
     * Given the OS platform is linux
     * When getLogFilePath is called with _platform="linux"
     * Then the returned path follows Linux conventions (.local/share/logs)
     */

    // Given: platform override is linux

    // When: the log file path is resolved
    const result = getLogFilePath("test-app", "test.log", "linux");

    // Then: the path follows Linux conventions
    const expected = resolve(homedir(), ".local", "share", "logs", "test-app", "test.log");
    expect(result).toBe(expected);
  });

  test("throws for unsupported platforms", () => {
    /**
     * Given the OS platform is an unsupported value
     * When getLogFilePath is called with _platform="freebsd"
     * Then it throws an error indicating the platform is unsupported
     */

    // Given: platform override is an unsupported value

    // When/Then: calling getLogFilePath throws
    expect(() => getLogFilePath("test-app", "test.log", "freebsd")).toThrow(
      "Unsupported operating system",
    );
  });
});
