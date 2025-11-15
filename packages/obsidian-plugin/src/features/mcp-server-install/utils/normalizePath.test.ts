import { describe, expect, test } from "bun:test";
import { normalizeDuplicateSegments } from "./normalizePath";

describe("normalizeDuplicateSegments", () => {
  test("removes duplicate /home/user pattern", () => {
    expect(normalizeDuplicateSegments("/home/user/home/user/vault")).toBe(
      "/home/user/vault"
    );
  });

  test("handles path without duplicates", () => {
    expect(normalizeDuplicateSegments("/home/user/vault")).toBe(
      "/home/user/vault"
    );
  });

  test("removes multiple consecutive duplicate patterns", () => {
    expect(normalizeDuplicateSegments("/a/b/a/b/a/b")).toBe("/a/b");
  });

  test("removes longer duplicate patterns", () => {
    expect(normalizeDuplicateSegments("/a/b/c/a/b/c/file")).toBe("/a/b/c/file");
  });

  test("handles relative paths", () => {
    expect(normalizeDuplicateSegments("home/user/home/user/vault")).toBe(
      "home/user/vault"
    );
  });

  test("preserves single occurrence of pattern", () => {
    expect(normalizeDuplicateSegments("/home/user/vault/user")).toBe(
      "/home/user/vault/user"
    );
  });

  test("handles complex real-world case", () => {
    expect(
      normalizeDuplicateSegments(
        "/home/john/home/john/vault/.obsidian/plugins/mcp-tools/bin"
      )
    ).toBe("/home/john/vault/.obsidian/plugins/mcp-tools/bin");
  });

  test("handles path with single segment", () => {
    expect(normalizeDuplicateSegments("/home")).toBe("/home");
  });

  test("handles empty relative path", () => {
    expect(normalizeDuplicateSegments("")).toBe("");
  });

  test("handles root path", () => {
    expect(normalizeDuplicateSegments("/")).toBe("/");
  });
});
