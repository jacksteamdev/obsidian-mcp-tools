import { describe, expect, test } from "bun:test";
import type { CommandAuditEntry } from "./types";
import {
  AUDIT_LOG_MAX_ENTRIES,
  appendAuditEntry,
  decidePermission,
  formatAllowlist,
  parseAllowlistCsv,
} from "./utils";

describe("parseAllowlistCsv", () => {
  test("returns an empty array for undefined, empty, or whitespace-only input", () => {
    expect(parseAllowlistCsv(undefined)).toEqual([]);
    expect(parseAllowlistCsv("")).toEqual([]);
    expect(parseAllowlistCsv("   ")).toEqual([]);
    expect(parseAllowlistCsv("\n\n")).toEqual([]);
  });

  test("splits on commas and trims whitespace", () => {
    expect(parseAllowlistCsv("editor:toggle-bold, graph:open")).toEqual([
      "editor:toggle-bold",
      "graph:open",
    ]);
  });

  test("splits on newlines as well as commas", () => {
    // Users may paste multi-line output from list_obsidian_commands.
    expect(
      parseAllowlistCsv("editor:toggle-bold\ngraph:open,workspace:save"),
    ).toEqual(["editor:toggle-bold", "graph:open", "workspace:save"]);
  });

  test("drops empty entries from double commas or trailing commas", () => {
    expect(parseAllowlistCsv("a,,b,")).toEqual(["a", "b"]);
  });

  test("preserves duplicates — the user sees exactly what they typed", () => {
    // Same convention as tool-toggle: dedupe is handled at the edge,
    // not in the parser, so users can spot their own typos.
    expect(parseAllowlistCsv("a, a, b")).toEqual(["a", "a", "b"]);
  });
});

describe("formatAllowlist", () => {
  test("joins entries with comma-space", () => {
    expect(formatAllowlist(["editor:toggle-bold", "graph:open"])).toBe(
      "editor:toggle-bold, graph:open",
    );
  });

  test("trims each entry and drops empties", () => {
    expect(formatAllowlist([" a ", "", "b", "   "])).toBe("a, b");
  });

  test("returns an empty string for an empty array", () => {
    expect(formatAllowlist([])).toBe("");
  });
});

describe("appendAuditEntry", () => {
  const entry = (commandId: string): CommandAuditEntry => ({
    timestamp: "2026-04-11T20:00:00.000Z",
    commandId,
    decision: "allow",
  });

  test("appends to an empty/undefined buffer", () => {
    expect(appendAuditEntry(undefined, entry("editor:toggle-bold"))).toEqual([
      entry("editor:toggle-bold"),
    ]);
  });

  test("appends to a non-empty buffer preserving order (newest last)", () => {
    const initial = [entry("a"), entry("b")];
    const result = appendAuditEntry(initial, entry("c"));
    expect(result.map((e) => e.commandId)).toEqual(["a", "b", "c"]);
  });

  test("does not mutate the input array", () => {
    const initial: CommandAuditEntry[] = [entry("a")];
    appendAuditEntry(initial, entry("b"));
    expect(initial).toEqual([entry("a")]);
  });

  test("truncates to AUDIT_LOG_MAX_ENTRIES when the buffer grows past the cap", () => {
    // Build a buffer that is exactly at the cap, then append one more.
    // The oldest entry should be evicted.
    const full: CommandAuditEntry[] = [];
    for (let i = 0; i < AUDIT_LOG_MAX_ENTRIES; i++) {
      full.push(entry(`cmd-${i}`));
    }
    const result = appendAuditEntry(full, entry("cmd-new"));
    expect(result.length).toBe(AUDIT_LOG_MAX_ENTRIES);
    // The oldest entry (cmd-0) is gone; the newest (cmd-new) is last.
    expect(result[0].commandId).toBe("cmd-1");
    expect(result[result.length - 1].commandId).toBe("cmd-new");
  });
});

describe("decidePermission", () => {
  test("denies when enabled is false", () => {
    expect(decidePermission("editor:toggle-bold", false, ["editor:toggle-bold"]).decision).toBe(
      "deny",
    );
  });

  test("denies when enabled is undefined (default-off)", () => {
    // The whole feature is opt-in; forgetting to set enabled must
    // not silently authorize the command.
    expect(decidePermission("editor:toggle-bold", undefined, ["editor:toggle-bold"]).decision).toBe(
      "deny",
    );
  });

  test("denies when the allowlist is empty", () => {
    expect(decidePermission("editor:toggle-bold", true, []).decision).toBe("deny");
    expect(decidePermission("editor:toggle-bold", true, undefined).decision).toBe("deny");
  });

  test("denies when the command id is not in the allowlist", () => {
    expect(
      decidePermission("editor:delete-file", true, ["editor:toggle-bold"]).decision,
    ).toBe("deny");
  });

  test("allows when enabled is true and the command id is in the allowlist", () => {
    const result = decidePermission("editor:toggle-bold", true, [
      "editor:toggle-bold",
      "graph:open",
    ]);
    expect(result.decision).toBe("allow");
    expect(result.reason).toBeUndefined();
  });

  test("denied decisions include a human-readable reason", () => {
    // The reason is surfaced back to the MCP client as the error
    // message, so it must be present and descriptive.
    const result = decidePermission("editor:delete-file", true, ["editor:toggle-bold"]);
    expect(result.decision).toBe("deny");
    expect(result.reason).toBeDefined();
    expect(result.reason).toContain("allowlist");
  });
});
