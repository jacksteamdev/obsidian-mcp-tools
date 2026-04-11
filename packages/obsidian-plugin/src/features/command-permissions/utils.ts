/**
 * Pure helpers for the command-permissions feature. No Obsidian or
 * plugin-runtime dependencies — exported so they can be unit-tested
 * in isolation, same pattern as tool-toggle/utils.ts.
 */

import type { CommandAuditEntry } from "./types";

/**
 * Maximum number of audit log entries retained in the ring buffer.
 * The settings UI only reads from this buffer (Fase 2 will add a
 * viewer); the main goal is to keep data.json bounded while still
 * giving the user a window into recent activity.
 */
export const AUDIT_LOG_MAX_ENTRIES = 50;

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
