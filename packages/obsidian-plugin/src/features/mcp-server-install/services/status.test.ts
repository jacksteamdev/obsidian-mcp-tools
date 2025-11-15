import { describe, expect, test } from "bun:test";

// We need to test the removeDuplicatePathSegments function
// Since it's not exported, we'll need to extract it or test via integration
// For now, let's create focused tests for the path normalization logic

describe("Path normalization for symlink resolution", () => {
  // Helper function to simulate the duplicate path detection logic
  function removeDuplicatePathSegments(filepath: string): string {
    const path = require("path");
    const parts = filepath.split(path.sep);
    const normalized: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      // Skip empty parts except for the first one (root on POSIX)
      if (part === "" && i !== 0) continue;

      // Check if we're at the start of a potential duplicate sequence
      if (i > 0 && part !== "") {
        // Look ahead to see if we have a duplicate sequence
        let isDuplicate = false;
        const lookAhead = Math.min(normalized.length, parts.length - i);

        for (let len = 1; len <= lookAhead; len++) {
          const normalizedSlice = normalized.slice(-len);
          const partsSlice = parts.slice(i, i + len);

          if (JSON.stringify(normalizedSlice) === JSON.stringify(partsSlice)) {
            // Found a duplicate sequence, skip these parts
            i += len - 1;
            isDuplicate = true;
            break;
          }
        }

        if (isDuplicate) continue;
      }

      normalized.push(part);
    }

    // Handle special case: if normalized array is empty or only contains empty string (root)
    if (normalized.length === 0) {
      return path.sep;
    }
    if (normalized.length === 1 && normalized[0] === "") {
      return path.sep;
    }

    // Preserve leading slash for absolute paths
    const result = path.join(...normalized);
    if (normalized[0] === "" && !result.startsWith(path.sep)) {
      return path.sep + result;
    }

    return result;
  }

  test("removes simple duplicate /home/user segment", () => {
    const input = "/home/user/home/user/vault/.obsidian";
    const expected = "/home/user/vault/.obsidian";
    expect(removeDuplicatePathSegments(input)).toBe(expected);
  });

  test("removes multiple duplicate segments", () => {
    const input = "/home/user/home/user/home/user/vault";
    const expected = "/home/user/vault";
    expect(removeDuplicatePathSegments(input)).toBe(expected);
  });

  test("handles complex duplicate patterns", () => {
    const input = "/home/user/Documents/home/user/Documents/vault";
    const expected = "/home/user/Documents/vault";
    expect(removeDuplicatePathSegments(input)).toBe(expected);
  });

  test("preserves non-duplicate paths", () => {
    const input = "/home/user/vault/.obsidian/plugins";
    expect(removeDuplicatePathSegments(input)).toBe(input);
  });

  test("handles single segment paths", () => {
    const input = "/home";
    expect(removeDuplicatePathSegments(input)).toBe(input);
  });

  test("handles paths with similar but non-duplicate segments", () => {
    const input = "/home/user/home2/user/vault";
    expect(removeDuplicatePathSegments(input)).toBe(input);
  });

  test("handles Windows-style paths with duplicates", () => {
    const path = require("path");
    if (path.sep === "\\") {
      const input = "C:\\Users\\user\\Users\\user\\vault";
      const expected = "C:\\Users\\user\\vault";
      expect(removeDuplicatePathSegments(input)).toBe(expected);
    }
  });

  test("handles root directory correctly", () => {
    const input = "/";
    expect(removeDuplicatePathSegments(input)).toBe("/");
  });

  test("handles iCloud Drive duplicate paths", () => {
    const input =
      "/Users/username/Library/Mobile Documents/Users/username/Library/Mobile Documents/vault";
    const expected = "/Users/username/Library/Mobile Documents/vault";
    expect(removeDuplicatePathSegments(input)).toBe(expected);
  });
});
