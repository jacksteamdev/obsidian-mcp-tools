import { describe, expect, test } from "bun:test";
import type { Plugin, McpToolsPluginSettings } from "obsidian";
import { getPlatform, getArch } from "./install";

describe("getPlatform", () => {
  test("returns detected platform when no plugin provided", () => {
    const platform = getPlatform();
    expect(["windows", "macos", "linux"]).toContain(platform);
  });

  test("returns detected platform when no custom platform in settings", () => {
    const mockPlugin = {
      settings: {} as McpToolsPluginSettings,
    } as any as Plugin;

    const platform = getPlatform(mockPlugin);
    expect(["windows", "macos", "linux"]).toContain(platform);
  });

  test("returns custom platform when specified in settings", () => {
    const mockPlugin = {
      settings: {
        customPlatform: "linux",
      } as McpToolsPluginSettings,
    } as any as Plugin;

    const platform = getPlatform(mockPlugin);
    expect(platform).toBe("linux");
  });

  test("overrides detected platform with custom platform", () => {
    const mockPlugin = {
      settings: {
        customPlatform: "windows",
      } as McpToolsPluginSettings,
    } as any as Plugin;

    const platform = getPlatform(mockPlugin);
    // Even if running on macOS/Linux, should return windows
    expect(platform).toBe("windows");
  });
});

describe("getArch", () => {
  test("returns detected architecture when no plugin provided", () => {
    const arch = getArch();
    expect(["x64", "arm64"]).toContain(arch);
  });

  test("returns detected architecture when no custom arch in settings", () => {
    const mockPlugin = {
      settings: {} as McpToolsPluginSettings,
    } as any as Plugin;

    const arch = getArch(mockPlugin);
    expect(["x64", "arm64"]).toContain(arch);
  });

  test("returns custom architecture when specified in settings", () => {
    const mockPlugin = {
      settings: {
        customArch: "arm64",
      } as McpToolsPluginSettings,
    } as any as Plugin;

    const arch = getArch(mockPlugin);
    expect(arch).toBe("arm64");
  });

  test("overrides detected architecture with custom architecture", () => {
    const mockPlugin = {
      settings: {
        customArch: "x64",
      } as McpToolsPluginSettings,
    } as any as Plugin;

    const arch = getArch(mockPlugin);
    expect(arch).toBe("x64");
  });
});
