/**
 * Settings augmentation for the command-permissions feature (issue #29
 * MVP). Kept here, inside the feature module, per the .clinerules rule
 * that features own their own types.
 *
 * Semantics:
 * - `enabled` undefined OR false → command execution is DISABLED by
 *   default. Even if the allowlist contains entries, the server's
 *   permission check will return { decision: "deny" }.
 * - `enabled` true + command id NOT in `allowlist` → denied.
 * - `enabled` true + command id in `allowlist` → allowed, the server
 *   proceeds with the execution call.
 *
 * This is intentionally a single lever (not a separate "master enable"
 * vs "killswitch"). See docs/design/issue-29-command-execution.md for
 * the reasoning.
 *
 * The `recentInvocations` ring buffer is the audit log surface. The
 * plugin appends entries here on every permission check (both allowed
 * and denied). Fase 1 only populates it; Fase 2 will add a viewer UI.
 * The buffer is bounded — the plugin must truncate to the last 50
 * entries before persisting so `data.json` does not grow unbounded.
 */
declare module "obsidian" {
  interface McpToolsPluginSettings {
    commandPermissions?: {
      /** Master enable toggle for command execution. Default: false. */
      enabled?: boolean;

      /**
       * Comma/newline-separated list of command ids the user has
       * pre-authorized. Stored as a string array for simpler merging
       * across Svelte reactivity.
       */
      allowlist?: string[];

      /**
       * Ring buffer of recent permission-check outcomes, newest last.
       * Appended to by the permission handler. Pruned to the last 50
       * entries on every write.
       */
      recentInvocations?: CommandAuditEntry[];

      /**
       * Soft rate-limit threshold (commands per rolling 60s window).
       * When exceeded, the confirmation modal surfaces a red warning
       * banner counting the recent calls. Purely informational — the
       * hard enforcement (100/min) lives in the MCP server binary
       * and cannot be configured from here.
       *
       * Undefined → plugin falls back to SOFT_RATE_LIMIT_PER_MINUTE.
       * Valid range 1..300 (enforced at settings save).
       */
      softRateLimit?: number;
    };
  }
}

export interface CommandAuditEntry {
  /** ISO 8601 timestamp. */
  timestamp: string;
  /** The command id the agent asked for. */
  commandId: string;
  /** Final decision returned to the MCP server. */
  decision: "allow" | "deny";
  /** Why the decision was made (for denied calls). Optional. */
  reason?: string;
}

export {};
