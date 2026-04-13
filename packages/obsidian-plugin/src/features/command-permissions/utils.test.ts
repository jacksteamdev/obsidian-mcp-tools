import { describe, expect, test } from "bun:test";
import type { CommandAuditEntry } from "./types";
import {
  AUDIT_LOG_MAX_ENTRIES,
  appendAuditEntry,
  auditLogCsvFilename,
  auditLogToCsv,
  createRuntimeRateCounter,
  decidePermission,
  formatAllowlist,
  isDestructiveCommand,
  normalizeSoftRateLimit,
  parseAllowlistCsv,
  SOFT_RATE_LIMIT_MAX,
  SOFT_RATE_LIMIT_MIN,
  SOFT_RATE_LIMIT_PER_MINUTE,
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

describe("isDestructiveCommand", () => {
  test("flags delete/remove/trash/purge/etc. in the command id", () => {
    // Every keyword in the regex must produce a match when used as a
    // distinct word inside a command id.
    for (const word of [
      "delete",
      "remove",
      "uninstall",
      "trash",
      "clean",
      "cleanup",
      "purge",
      "drop",
      "reset",
      "clear",
      "wipe",
    ]) {
      expect(isDestructiveCommand(`editor:${word}-file`)).toBe(true);
    }
  });

  test("is case-insensitive", () => {
    expect(isDestructiveCommand("editor:DELETE-file")).toBe(true);
    expect(isDestructiveCommand("myPlugin:Clean-Up-Duplicates")).toBe(true);
    expect(isDestructiveCommand("PLUGIN:PURGE")).toBe(true);
  });

  test("does not match destructive words glued to other words without a separator", () => {
    // This is a deliberate trade-off: \b word boundaries catch the
    // common Obsidian command-id conventions (kebab-case, colon-
    // separated, snake_case) but miss CamelCaseGluedWords. The
    // alternative (no word boundary) would produce unacceptable
    // false positives like "presetter" matching "reset". For now
    // we accept the blind spot; Fase 3 can add a tokenizer if needed.
    expect(isDestructiveCommand("myPlugin:CleanUpDuplicates")).toBe(false);
  });

  test("also checks the human-readable command name", () => {
    // A command id can be innocuous while the name announces the
    // effect ("ws:op" → "Delete vault"). Catching either side is a
    // nudge, not a gate.
    expect(isDestructiveCommand("ws:op", "Delete vault")).toBe(true);
    expect(isDestructiveCommand("ws:op", "Toggle bold")).toBe(false);
    expect(isDestructiveCommand("ws:op")).toBe(false);
  });

  test("does not flag commands that merely contain a destructive word as a substring of another word", () => {
    // Word boundary check: "delete" as a substring of a longer word
    // should NOT match (e.g. "undelete" contains "delete" but the \b
    // anchors prevent a false positive).
    // Similarly, "reset" as a substring of "presetter" should not match.
    expect(isDestructiveCommand("myPlugin:undeleted-files")).toBe(false);
    expect(isDestructiveCommand("ui:presetter")).toBe(false);
  });

  test("does not flag safe commands", () => {
    expect(isDestructiveCommand("editor:toggle-bold")).toBe(false);
    expect(isDestructiveCommand("graph:open")).toBe(false);
    expect(isDestructiveCommand("workspace:save")).toBe(false);
    expect(isDestructiveCommand("file-explorer:reveal-active-file")).toBe(false);
  });
});

describe("createRuntimeRateCounter", () => {
  test("returns 0 when nothing has been recorded", () => {
    const counter = createRuntimeRateCounter();
    expect(counter.countInLastMinute()).toBe(0);
    expect(counter.isSoftLimitExceeded()).toBe(false);
  });

  test("counts events within the rolling window", () => {
    // Deterministic clock — same millisecond for all three records
    // puts everything well inside the 60s window regardless of the
    // wall clock.
    const counter = createRuntimeRateCounter();
    counter.record(1000);
    counter.record(2000);
    counter.record(3000);
    expect(counter.countInLastMinute(3000)).toBe(3);
  });

  test("prunes events older than the window", () => {
    // Record at t=0, then advance past the 60s window.
    const counter = createRuntimeRateCounter();
    counter.record(0);
    counter.record(10_000);
    counter.record(20_000);
    // At t=70_000, only the entries >= t-60_000 = 10_000 survive, and
    // since we prune strictly <=, t=10_000 itself falls out.
    expect(counter.countInLastMinute(70_000)).toBe(1);
    // Advance further; even the 20_000 entry ages out eventually.
    expect(counter.countInLastMinute(80_001)).toBe(0);
  });

  test("isSoftLimitExceeded fires strictly above the limit, not at it", () => {
    // A counter with a soft limit of 2 records two events within the
    // window: `countInLastMinute` returns 2, `isSoftLimitExceeded`
    // returns false. The third event flips the flag.
    const counter = createRuntimeRateCounter(60_000, 2);
    counter.record(1000);
    counter.record(1001);
    expect(counter.countInLastMinute(1002)).toBe(2);
    expect(counter.isSoftLimitExceeded(1002)).toBe(false);
    counter.record(1002);
    expect(counter.isSoftLimitExceeded(1002)).toBe(true);
  });

  test("defaults match the SOFT_RATE_LIMIT_PER_MINUTE constant", () => {
    // A counter with default settings must respect the documented
    // public constant; if someone bumps one but not the other, this
    // test fails and flags the mistake.
    const counter = createRuntimeRateCounter();
    // Fill up to exactly the soft limit.
    for (let i = 0; i < SOFT_RATE_LIMIT_PER_MINUTE; i++) {
      counter.record(1000 + i);
    }
    expect(counter.isSoftLimitExceeded(1000 + SOFT_RATE_LIMIT_PER_MINUTE)).toBe(
      false,
    );
    // One more flips it.
    counter.record(1000 + SOFT_RATE_LIMIT_PER_MINUTE);
    expect(counter.isSoftLimitExceeded(1000 + SOFT_RATE_LIMIT_PER_MINUTE)).toBe(
      true,
    );
  });

  test("repeated prunes are idempotent (stable state across calls)", () => {
    const counter = createRuntimeRateCounter();
    counter.record(1000);
    counter.record(2000);
    // Both reads advance past the window; the second must not throw
    // and must continue returning 0.
    expect(counter.countInLastMinute(70_000)).toBe(0);
    expect(counter.countInLastMinute(70_000)).toBe(0);
    counter.record(70_001);
    expect(counter.countInLastMinute(70_001)).toBe(1);
  });
});

describe("auditLogToCsv", () => {
  const entry = (
    commandId: string,
    decision: "allow" | "deny" = "allow",
    reason?: string,
  ): CommandAuditEntry => ({
    timestamp: "2026-04-13T09:00:00.000Z",
    commandId,
    decision,
    ...(reason ? { reason } : {}),
  });

  test("emits just the header row for an empty log", () => {
    const csv = auditLogToCsv([]);
    expect(csv).toBe("timestamp,commandId,decision,reason\r\n");
  });

  test("appends rows in input order with CRLF line terminators", () => {
    const csv = auditLogToCsv([
      entry("editor:toggle-bold", "allow"),
      entry("graph:open", "deny", "Not in allowlist"),
    ]);
    expect(csv).toBe(
      "timestamp,commandId,decision,reason\r\n" +
        "2026-04-13T09:00:00.000Z,editor:toggle-bold,allow,\r\n" +
        "2026-04-13T09:00:00.000Z,graph:open,deny,Not in allowlist\r\n",
    );
  });

  test("quotes fields that contain a comma", () => {
    // Reason text often contains commas — the output must be
    // parseable by any RFC 4180 CSV reader.
    const csv = auditLogToCsv([
      entry("editor:toggle-bold", "deny", "Command, unauthorized"),
    ]);
    expect(csv).toContain('"Command, unauthorized"');
  });

  test("doubles embedded double quotes inside quoted fields", () => {
    const csv = auditLogToCsv([
      entry("editor:toggle-bold", "deny", 'Reason: "not allowed"'),
    ]);
    // Outer quotes wrap the field; inner quotes are doubled.
    expect(csv).toContain('"Reason: ""not allowed"""');
  });

  test("quotes fields that contain CR or LF", () => {
    const csv = auditLogToCsv([
      entry("editor:toggle-bold", "deny", "Line 1\nLine 2"),
    ]);
    expect(csv).toContain('"Line 1\nLine 2"');
  });

  test("emits an empty string for missing reason", () => {
    const csv = auditLogToCsv([entry("editor:toggle-bold", "allow")]);
    // Allow rows have no reason — the column must be present but empty.
    expect(csv).toContain(",allow,\r\n");
  });
});

describe("normalizeSoftRateLimit", () => {
  test("returns undefined for undefined input (fall back to default)", () => {
    expect(normalizeSoftRateLimit(undefined)).toBeUndefined();
  });

  test("returns undefined for 0, negative, NaN, or Infinity", () => {
    expect(normalizeSoftRateLimit(0)).toBeUndefined();
    expect(normalizeSoftRateLimit(-5)).toBeUndefined();
    expect(normalizeSoftRateLimit(Number.NaN)).toBeUndefined();
    expect(normalizeSoftRateLimit(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  test("rounds fractional values to the nearest integer", () => {
    expect(normalizeSoftRateLimit(42.4)).toBe(42);
    expect(normalizeSoftRateLimit(42.6)).toBe(43);
  });

  test("clamps below SOFT_RATE_LIMIT_MIN", () => {
    // Practical range starts at 1 — the input validator rounds
    // before clamping, so 0.4 becomes 0 and returns undefined; any
    // value that survives rounding gets clamped to at least MIN.
    expect(normalizeSoftRateLimit(0.5)).toBe(SOFT_RATE_LIMIT_MIN);
  });

  test("clamps above SOFT_RATE_LIMIT_MAX", () => {
    expect(normalizeSoftRateLimit(999_999)).toBe(SOFT_RATE_LIMIT_MAX);
  });

  test("passes values inside the valid range through unchanged", () => {
    expect(normalizeSoftRateLimit(30)).toBe(30);
    expect(normalizeSoftRateLimit(SOFT_RATE_LIMIT_MIN)).toBe(
      SOFT_RATE_LIMIT_MIN,
    );
    expect(normalizeSoftRateLimit(SOFT_RATE_LIMIT_MAX)).toBe(
      SOFT_RATE_LIMIT_MAX,
    );
  });
});

describe("auditLogCsvFilename", () => {
  test("stamps the filename with YYYY-MM-DD derived from the provided date", () => {
    const filename = auditLogCsvFilename(new Date("2026-04-13T15:30:00Z"));
    expect(filename).toBe("mcp-tools-audit-2026-04-13.csv");
  });

  test("defaults to the current date when no argument is provided", () => {
    // We only assert the prefix/suffix shape since the actual date
    // depends on when the test runs.
    const filename = auditLogCsvFilename();
    expect(filename).toMatch(
      /^mcp-tools-audit-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});
