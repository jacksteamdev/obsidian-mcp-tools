import { describe, expect, test } from "bun:test";
import {
  KNOWN_MCP_TOOL_NAMES,
  parseDisabledToolsCsv,
  serializeDisabledToolsToEnv,
} from "./utils";

describe("parseDisabledToolsCsv", () => {
  test("returns an empty array for undefined, empty, or whitespace-only input", () => {
    expect(parseDisabledToolsCsv(undefined)).toEqual([]);
    expect(parseDisabledToolsCsv("")).toEqual([]);
    expect(parseDisabledToolsCsv("   ")).toEqual([]);
    expect(parseDisabledToolsCsv("\n\n")).toEqual([]);
  });

  test("splits on commas and trims whitespace around each entry", () => {
    expect(parseDisabledToolsCsv("a, b ,  c")).toEqual(["a", "b", "c"]);
  });

  test("splits on newlines as well as commas", () => {
    // Users may paste multi-line input; both separators are accepted.
    expect(parseDisabledToolsCsv("a\nb,c\n\n d ")).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  test("drops empty entries from double commas or trailing commas", () => {
    expect(parseDisabledToolsCsv("a,,b,")).toEqual(["a", "b"]);
    expect(parseDisabledToolsCsv(",a,b")).toEqual(["a", "b"]);
  });

  test("preserves duplicates — the server sees exactly what was typed", () => {
    // Stripping duplicates in the UI would hide typos from the user.
    // The server logs each name it tries to disable, so duplicates
    // are harmless and diagnostically useful.
    expect(parseDisabledToolsCsv("a, a, b")).toEqual(["a", "a", "b"]);
  });
});

describe("serializeDisabledToolsToEnv", () => {
  test("returns undefined for an empty list", () => {
    // Returning undefined (rather than "") lets callers omit the env
    // var entirely, keeping the client config file tidy.
    expect(serializeDisabledToolsToEnv([])).toBeUndefined();
  });

  test("returns undefined for a list with only whitespace entries", () => {
    expect(serializeDisabledToolsToEnv(["", "   ", "\t"])).toBeUndefined();
  });

  test("joins names with ', ' and trims each entry", () => {
    expect(serializeDisabledToolsToEnv(["a ", " b", "c"])).toBe("a, b, c");
  });

  test("drops whitespace-only entries from a mixed list", () => {
    expect(serializeDisabledToolsToEnv(["a", "", "b", "  "])).toBe("a, b");
  });
});

describe("KNOWN_MCP_TOOL_NAMES", () => {
  test("contains exactly 18 tool names (matching the server's advertised count)", () => {
    // If this number changes, update both the list in utils.ts and
    // the MCP surface section in CLAUDE.md.
    expect(KNOWN_MCP_TOOL_NAMES.length).toBe(18);
  });

  test("has no duplicate entries", () => {
    expect(new Set(KNOWN_MCP_TOOL_NAMES).size).toBe(
      KNOWN_MCP_TOOL_NAMES.length,
    );
  });

  test("includes the expected critical tools", () => {
    // Spot-check a few well-known names that must never be renamed
    // without coordinating this list with the server registry.
    expect(KNOWN_MCP_TOOL_NAMES).toContain("get_server_info");
    expect(KNOWN_MCP_TOOL_NAMES).toContain("patch_vault_file");
    expect(KNOWN_MCP_TOOL_NAMES).toContain("search_vault_smart");
    expect(KNOWN_MCP_TOOL_NAMES).toContain("execute_template");
    expect(KNOWN_MCP_TOOL_NAMES).toContain("fetch");
  });
});
