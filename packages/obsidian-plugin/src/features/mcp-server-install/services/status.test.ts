import { describe, expect, test } from "bun:test";
import path from "path";
import { removeDuplicatePathSegments } from "./pathSegments";

describe("removeDuplicatePathSegments", () => {
  test("collapses a simple duplicated /home/user segment", () => {
    expect(
      removeDuplicatePathSegments("/home/user/home/user/vault/.obsidian"),
    ).toBe("/home/user/vault/.obsidian");
  });

  test("collapses multiple duplicated runs", () => {
    expect(
      removeDuplicatePathSegments("/home/user/home/user/home/user/vault"),
    ).toBe("/home/user/vault");
  });

  test("collapses a duplicated multi-segment prefix", () => {
    expect(
      removeDuplicatePathSegments(
        "/home/user/Documents/home/user/Documents/vault",
      ),
    ).toBe("/home/user/Documents/vault");
  });

  test("leaves non-duplicated paths unchanged", () => {
    const input = "/home/user/vault/.obsidian/plugins";
    expect(removeDuplicatePathSegments(input)).toBe(input);
  });

  test("handles single-segment absolute paths", () => {
    expect(removeDuplicatePathSegments("/home")).toBe("/home");
  });

  test("distinguishes similar but non-duplicate segments", () => {
    // "home2" is close to "home" but not identical, so no collapse.
    const input = "/home/user/home2/user/vault";
    expect(removeDuplicatePathSegments(input)).toBe(input);
  });

  test("normalizes bare root to the platform separator", () => {
    expect(removeDuplicatePathSegments("/")).toBe(path.sep);
  });

  test("handles the real-world iCloud Drive duplication case", () => {
    expect(
      removeDuplicatePathSegments(
        "/Users/username/Library/Mobile Documents/Users/username/Library/Mobile Documents/vault",
      ),
    ).toBe("/Users/username/Library/Mobile Documents/vault");
  });
});
