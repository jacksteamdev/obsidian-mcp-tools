/**
 * In-memory tumbling-window rate limiter for `execute_obsidian_command`.
 *
 * Defense against a runaway LLM or prompt injection that tries to flood
 * the plugin with command invocations. A simple tumbling window (not
 * sliding) keyed by a Math.floor(now / windowMs) bucket: every call
 * increments the counter for the current bucket; when we transition
 * into a new bucket, old buckets are garbage-collected.
 *
 * The limit is intentionally conservative (100 per minute by default).
 * `list_obsidian_commands` is read-only and is NOT rate-limited — only
 * `execute_obsidian_command` goes through this check.
 *
 * State is per-process and in-memory, which is fine for an MVP:
 * - The MCP server is a per-client long-running process.
 * - Restarting the client (e.g. reloading Claude Desktop) resets
 *   the counter, which is acceptable — the purpose is to catch
 *   short bursts, not enforce long-term quotas.
 */

const DEFAULT_LIMIT = 100;
const DEFAULT_WINDOW_MS = 60_000;

interface RateLimiterState {
  /** Bucket key for the current window (Math.floor(now / windowMs) * windowMs). */
  windowStart: number;
  /** Number of commands executed in the current window. */
  count: number;
}

export interface RateLimiterOptions {
  /** Maximum number of commands allowed per window. Default 100. */
  limit?: number;
  /** Window size in milliseconds. Default 60000 (1 minute). */
  windowMs?: number;
  /**
   * Optional clock injection for tests. Production code should omit
   * this and use `Date.now()` implicitly.
   */
  now?: () => number;
}

/**
 * Create a rate-limiter closure. Each call to the returned function
 * either consumes one slot (returning `true`) or refuses because the
 * limit for the current window is already reached (returning `false`).
 *
 * Usage:
 *   const check = createRateLimiter({ limit: 100, windowMs: 60_000 });
 *   if (!check()) throw new Error("rate limit exceeded");
 *
 * Exported separately from the one-off helper below so tests can
 * instantiate isolated limiters with a fake clock.
 */
export function createRateLimiter(
  options: RateLimiterOptions = {},
): () => boolean {
  const limit = options.limit ?? DEFAULT_LIMIT;
  const windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
  const now = options.now ?? (() => Date.now());

  const state: RateLimiterState = {
    windowStart: 0,
    count: 0,
  };

  return () => {
    const currentWindowStart = Math.floor(now() / windowMs) * windowMs;

    if (currentWindowStart !== state.windowStart) {
      // New window: reset the counter. Old buckets are implicitly
      // discarded because we only ever track one at a time — no map,
      // no garbage collection loop needed.
      state.windowStart = currentWindowStart;
      state.count = 0;
    }

    if (state.count >= limit) {
      return false;
    }

    state.count += 1;
    return true;
  };
}

/**
 * Module-level default rate limiter instance used by the commands
 * feature. Shared across all invocations of `execute_obsidian_command`
 * for the lifetime of the server process.
 */
export const defaultCommandRateLimiter = createRateLimiter();
