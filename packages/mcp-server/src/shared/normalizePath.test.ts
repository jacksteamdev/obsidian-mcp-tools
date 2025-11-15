import { describe, expect, test } from "bun:test";
import { normalizeDirectory } from "./normalizePath";

describe("normalizeDirectory", () => {
  test("removes single trailing slash", () => {
    expect(normalizeDirectory("DevOps/")).toBe("DevOps");
  });

  test("removes multiple trailing slashes", () => {
    expect(normalizeDirectory("DevOps///")).toBe("DevOps");
  });

  test("leaves path without trailing slash unchanged", () => {
    expect(normalizeDirectory("DevOps")).toBe("DevOps");
  });

  test("handles nested paths with trailing slash", () => {
    expect(normalizeDirectory("path/to/dir/")).toBe("path/to/dir");
  });

  test("handles nested paths without trailing slash", () => {
    expect(normalizeDirectory("path/to/dir")).toBe("path/to/dir");
  });

  test("returns empty string for empty string", () => {
    expect(normalizeDirectory("")).toBe("");
  });

  test("returns undefined for undefined input", () => {
    expect(normalizeDirectory(undefined)).toBeUndefined();
  });

  test("handles root slash", () => {
    expect(normalizeDirectory("/")).toBe("");
  });

  test("handles path with only slashes", () => {
    expect(normalizeDirectory("///")).toBe("");
  });
});
