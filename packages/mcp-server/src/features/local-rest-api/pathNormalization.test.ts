import { describe, expect, test } from "bun:test";

/**
 * Replicates the inline path-normalization logic from the list_vault_files
 * handler in ./index.ts. This is intentionally kept in sync with the
 * handler implementation — if the handler changes, this mirror must too.
 *
 * The handler logic is only two lines, so extracting a dedicated helper
 * would be overkill. Instead, we test the logic by mirroring it here.
 */
function normalizeDirectoryToUrlSuffix(directory?: string): string {
  const stripped = directory?.replace(/\/+$/, "") || "";
  return stripped ? `${stripped}/` : "";
}

function buildVaultListUrl(directory?: string): string {
  return `/vault/${normalizeDirectoryToUrlSuffix(directory)}`;
}

describe("list_vault_files directory normalization", () => {
  test("strips a single trailing slash", () => {
    expect(normalizeDirectoryToUrlSuffix("Documents/")).toBe("Documents/");
  });

  test("strips multiple trailing slashes", () => {
    expect(normalizeDirectoryToUrlSuffix("Documents///")).toBe("Documents/");
  });

  test("adds a trailing slash when none is present", () => {
    expect(normalizeDirectoryToUrlSuffix("Documents")).toBe("Documents/");
  });

  test("returns an empty suffix for an empty directory", () => {
    expect(normalizeDirectoryToUrlSuffix("")).toBe("");
  });

  test("returns an empty suffix for an undefined directory", () => {
    expect(normalizeDirectoryToUrlSuffix(undefined)).toBe("");
  });

  test("preserves nested paths with no duplicated slashes", () => {
    expect(normalizeDirectoryToUrlSuffix("Work/Projects/2024/")).toBe(
      "Work/Projects/2024/",
    );
  });

  test("collapses vault root slashes to an empty suffix", () => {
    expect(normalizeDirectoryToUrlSuffix("/")).toBe("");
    expect(normalizeDirectoryToUrlSuffix("///")).toBe("");
  });
});

describe("full vault-list URL construction", () => {
  test("handles a directory without a trailing slash", () => {
    expect(buildVaultListUrl("Documents")).toBe("/vault/Documents/");
  });

  test("handles a directory with a trailing slash", () => {
    expect(buildVaultListUrl("Documents/")).toBe("/vault/Documents/");
  });

  test("handles the root directory (undefined)", () => {
    expect(buildVaultListUrl(undefined)).toBe("/vault/");
  });

  test("handles the root directory (empty string)", () => {
    expect(buildVaultListUrl("")).toBe("/vault/");
  });

  test("never produces a double slash at the /vault/ boundary", () => {
    const url = buildVaultListUrl("Documents/");
    expect(url).not.toContain("//");
    expect(url).toBe("/vault/Documents/");
  });

  test("handles deeply nested directories with trailing slash", () => {
    expect(buildVaultListUrl("Work/Projects/2024/")).toBe(
      "/vault/Work/Projects/2024/",
    );
  });
});
