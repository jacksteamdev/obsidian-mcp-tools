import { describe, expect, test } from "bun:test";

/**
 * Tests for path normalization logic used in list_vault_files tool
 * to prevent double slashes when constructing API paths
 */
describe("Path normalization for list_vault_files", () => {
  /**
   * Helper function that replicates the normalization logic from index.ts
   * This ensures trailing slashes are removed before constructing the API path
   */
  function normalizeDirectoryPath(directory?: string): string {
    // This replicates the logic from index.ts line 255-256
    const normalized = directory?.replace(/\/+$/, "") || "";
    const path = normalized ? `${normalized}/` : "";
    return path;
  }

  test("removes single trailing slash from directory", () => {
    const input = "Documents/";
    const expected = "Documents/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("removes multiple trailing slashes from directory", () => {
    const input = "Documents///";
    const expected = "Documents/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles directory without trailing slash", () => {
    const input = "Documents";
    const expected = "Documents/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles empty string directory", () => {
    const input = "";
    const expected = "";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles undefined directory", () => {
    const input = undefined;
    const expected = "";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles nested paths with trailing slashes", () => {
    const input = "Documents/Work/Projects/";
    const expected = "Documents/Work/Projects/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles nested paths with multiple trailing slashes", () => {
    const input = "Documents/Work/Projects///";
    const expected = "Documents/Work/Projects/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles root directory with single slash", () => {
    const input = "/";
    const expected = "";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("handles root directory with multiple slashes", () => {
    const input = "///";
    const expected = "";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });

  test("preserves internal slashes while removing trailing ones", () => {
    const input = "Documents/Work/Projects/2024/";
    const expected = "Documents/Work/Projects/2024/";
    expect(normalizeDirectoryPath(input)).toBe(expected);
  });
});

describe("API path construction prevents double slashes", () => {
  /**
   * Simulates the full path construction as done in index.ts
   * to verify no double slashes are created
   */
  function constructApiPath(directory?: string): string {
    const normalized = directory?.replace(/\/+$/, "") || "";
    const path = normalized ? `${normalized}/` : "";
    return `/vault/${path}`;
  }

  test("constructs correct path for directory without trailing slash", () => {
    expect(constructApiPath("Documents")).toBe("/vault/Documents/");
  });

  test("constructs correct path for directory with trailing slash", () => {
    expect(constructApiPath("Documents/")).toBe("/vault/Documents/");
  });

  test("constructs correct path for directory with multiple trailing slashes", () => {
    expect(constructApiPath("Documents///")).toBe("/vault/Documents/");
  });

  test("constructs correct path for root directory", () => {
    expect(constructApiPath("")).toBe("/vault/");
    expect(constructApiPath(undefined)).toBe("/vault/");
  });

  test("constructs correct path for nested directory", () => {
    expect(constructApiPath("Documents/Work/Projects")).toBe(
      "/vault/Documents/Work/Projects/",
    );
  });

  test("prevents double slashes at vault boundary", () => {
    // This was the bug: /vault//Documents/
    const path = constructApiPath("Documents/");
    expect(path).not.toContain("//");
    expect(path).toBe("/vault/Documents/");
  });
});
