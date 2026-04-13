/**
 * Pure helpers for the command-permissions feature. No Obsidian or
 * plugin-runtime dependencies — exported so they can be unit-tested
 * in isolation, same pattern as tool-toggle/utils.ts.
 */

import type { CommandAuditEntry } from "./types";

/**
 * Maximum number of audit log entries retained in the ring buffer.
 * The settings UI displays the last N invocations; the main goal is
 * to keep data.json bounded while still giving the user a window
 * into recent activity.
 */
export const AUDIT_LOG_MAX_ENTRIES = 50;

/**
 * Soft rate-limit threshold used by the Fase 2 confirmation modal
 * to warn the user that the agent has been unusually busy. This is
 * NOT enforcement — the server-side `rateLimit.ts` still drops calls
 * above 100/min hard. The soft limit exists only to surface a visible
 * "are you sure this is intentional?" nudge when a modal is shown.
 */
export const SOFT_RATE_LIMIT_PER_MINUTE = 30;

/**
 * Regex of command-id fragments that heuristically indicate a
 * destructive operation (file deletion, settings reset, vault cleanup,
 * etc.). Matches are word-boundary based and case-insensitive so they
 * catch both `editor:delete-file` and `myPlugin:CleanUpDuplicates`.
 *
 * This is a nudge, not a gate — the user still has the final say via
 * the modal. The point is to disable "Allow always" on matching
 * commands so the user cannot silently add an unbounded command to
 * their persistent allowlist without thinking about it.
 */
const DESTRUCTIVE_PATTERN =
  /\b(delete|remove|uninstall|trash|clean(?:up)?|purge|drop|reset|clear|wipe)\b/i;

/**
 * True if the command id OR the human-readable name contains a word
 * that heuristically suggests a destructive effect. The check runs
 * against both because plugin authors sometimes hide destructive
 * intent behind an innocuous id and a telltale name (or vice versa).
 */
export function isDestructiveCommand(
  commandId: string,
  commandName?: string,
): boolean {
  if (DESTRUCTIVE_PATTERN.test(commandId)) return true;
  if (commandName && DESTRUCTIVE_PATTERN.test(commandName)) return true;
  return false;
}

/**
 * Rolling-window event counter used by the permission-check handler
 * to display the Fase 2 soft rate-limit warning in the confirmation
 * modal. Each `record()` pushes an event timestamp onto an internal
 * array, and both read methods prune entries older than `windowMs`
 * before answering. The counter is in-memory only — it resets when
 * the plugin reloads, which matches the design intent (catch short
 * bursts, not enforce long-term quotas).
 *
 * All methods accept an optional `now` argument so tests can drive
 * time deterministically.
 */
export interface RuntimeRateCounter {
  record(now?: number): void;
  countInLastMinute(now?: number): number;
  isSoftLimitExceeded(now?: number): boolean;
}

export function createRuntimeRateCounter(
  windowMs: number = 60_000,
  softLimit: number = SOFT_RATE_LIMIT_PER_MINUTE,
): RuntimeRateCounter {
  // Ordered oldest → newest. We only ever append and shift from the
  // front, so the array is always sorted by time.
  const timestamps: number[] = [];

  function prune(now: number) {
    const cutoff = now - windowMs;
    while (timestamps.length > 0 && timestamps[0]! <= cutoff) {
      timestamps.shift();
    }
  }

  return {
    record(now: number = Date.now()) {
      timestamps.push(now);
      prune(now);
    },
    countInLastMinute(now: number = Date.now()) {
      prune(now);
      return timestamps.length;
    },
    isSoftLimitExceeded(now: number = Date.now()) {
      prune(now);
      return timestamps.length > softLimit;
    },
  };
}

/**
 * Parse a comma-or-newline separated list of command ids as typed
 * into the allowlist textarea. Whitespace around entries is trimmed
 * and empty entries (from double commas, trailing commas, or blank
 * lines) are dropped. Duplicates are preserved — the server checks
 * `Array.includes`, so duplicates are harmless and the user may want
 * to see what they typed.
 *
 * Same shape as `tool-toggle/utils.ts::parseDisabledToolsCsv`.
 */
export function parseAllowlistCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Format an allowlist as the display value for the settings textarea.
 * Lines are joined with ", " for readability; the parser accepts both
 * comma and newline separators so users can paste multi-line content.
 */
export function formatAllowlist(allowlist: readonly string[]): string {
  return allowlist
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .join(", ");
}

/**
 * Append an entry to an audit log ring buffer and truncate to the
 * configured maximum. Returns a new array — does not mutate the
 * input. Intended to be called on every permission check.
 *
 *   settings.commandPermissions.recentInvocations =
 *     appendAuditEntry(settings.commandPermissions.recentInvocations, {
 *       timestamp: new Date().toISOString(),
 *       commandId,
 *       decision: "allow",
 *     });
 */
export function appendAuditEntry(
  existing: readonly CommandAuditEntry[] | undefined,
  entry: CommandAuditEntry,
): CommandAuditEntry[] {
  const base = existing ?? [];
  const next = [...base, entry];
  // Keep only the most recent N entries. If the buffer is already
  // shorter than the cap, slice returns a copy of the full array.
  return next.slice(-AUDIT_LOG_MAX_ENTRIES);
}

/**
 * RFC 4180 single-field CSV escape. Values containing a comma, a
 * double quote, CR or LF are wrapped in double quotes; embedded
 * double quotes are doubled. All other values pass through unchanged.
 */
function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/**
 * Serialize an audit log to RFC 4180 CSV with a fixed header:
 *
 *     timestamp,commandId,decision,reason
 *
 * Rows are emitted in input order — the caller is responsible for
 * sorting if chronological output is desired. The output terminates
 * with CRLF on the final row so the file is well-formed regardless
 * of how the receiving tool handles trailing newlines.
 *
 * The `reason` column is always present; rows without a reason get
 * an empty value. Keeping the schema stable simplifies downstream
 * automation.
 */
export function auditLogToCsv(
  entries: readonly CommandAuditEntry[],
): string {
  const header = ["timestamp", "commandId", "decision", "reason"];
  const rows: string[] = [header.map(csvEscape).join(",")];
  for (const entry of entries) {
    rows.push(
      [
        entry.timestamp,
        entry.commandId,
        entry.decision,
        entry.reason ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return rows.join("\r\n") + "\r\n";
}

/**
 * Build the default download filename for an audit-log CSV export,
 * stamped with the provided date in ISO YYYY-MM-DD form. Exposed so
 * tests can pin the date without mocking the global clock.
 */
export function auditLogCsvFilename(now: Date = new Date()): string {
  const iso = now.toISOString();
  const datePart = iso.slice(0, 10); // YYYY-MM-DD
  return `mcp-tools-audit-${datePart}.csv`;
}

/**
 * Centralized permission decision logic. Pure — takes the relevant
 * slice of settings plus the command id and returns the outcome that
 * the HTTP handler should respond with. Kept separate from the HTTP
 * layer so tests don't need to mock Express.
 */
export function decidePermission(
  commandId: string,
  enabled: boolean | undefined,
  allowlist: readonly string[] | undefined,
): { decision: "allow" | "deny"; reason?: string } {
  if (!enabled) {
    return {
      decision: "deny",
      reason:
        "MCP command execution is disabled in plugin settings. Enable 'Command execution' in the MCP Tools settings to allow the agent to run commands.",
    };
  }

  if (!allowlist || allowlist.length === 0) {
    return {
      decision: "deny",
      reason: `Command '${commandId}' is not in the user's allowlist. Add it in MCP Tools settings → Command execution → Allowlist to authorize it.`,
    };
  }

  if (!allowlist.includes(commandId)) {
    return {
      decision: "deny",
      reason: `Command '${commandId}' is not in the user's allowlist. Add it in MCP Tools settings → Command execution → Allowlist to authorize it.`,
    };
  }

  return { decision: "allow" };
}
