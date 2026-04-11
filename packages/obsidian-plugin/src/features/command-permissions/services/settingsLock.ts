/**
 * A minimal async mutex for serializing critical sections.
 *
 * Used by the command-permission handler to protect the load-modify-
 * save cycle around `plugin.loadData()` / `plugin.saveData()`, which
 * otherwise races under concurrent HTTP invocations.
 *
 * ## The bug we are fixing
 *
 * The original Fase 1 handler read settings, appended an audit entry,
 * and wrote settings back. Each step is independently async (there is
 * an `await` between the read and the write), so when N concurrent
 * curls hit the endpoint in the same millisecond, they all read the
 * SAME "before" state, each constructs its own "before + my entry"
 * version, and each writes back. Only the last writer wins; the
 * others are silently clobbered. Fase 2's rate-limit smoke test
 * (35 parallel fast-path calls) made the loss visible: only 3 of
 * the 35 audit entries survived.
 *
 * ## The fix
 *
 * A single module-level mutex serializes every read/modify/write
 * cycle. Critically, the mutex is acquired ONLY around the settings
 * I/O — NOT around the modal wait. This keeps the fast path fast
 * (concurrent fast-path calls are serialized, but each critical
 * section is ~milliseconds) and lets multiple confirmation modals
 * coexist on-screen without the lock blocking progress.
 *
 * ## Implementation
 *
 * Each acquirer awaits a Promise representing the "tail" of the
 * queue. When its critical section completes (or throws), the next
 * acquirer is released. The tail is advanced synchronously inside
 * the `run` function so that two calls arriving in the same
 * microtask slot correctly chain — the second call sees a tail
 * that already includes the first call's completion promise.
 *
 * ## What this is NOT
 *
 * This mutex is in-process only. It serializes within a single
 * plugin instance; it does NOT coordinate across multiple Obsidian
 * windows, multiple vaults, or multiple processes. For this feature
 * that is sufficient — Obsidian only loads one instance of a given
 * plugin per vault, and each vault has its own `data.json`.
 *
 * ## Usage
 *
 *     const mutex = createMutex();
 *     await mutex.run(async () => {
 *       const settings = await plugin.loadData();
 *       settings.foo = "bar";
 *       await plugin.saveData(settings);
 *     });
 *
 * The callback returns a promise; the mutex resolves when the
 * callback's promise resolves (or rejects). Errors are propagated
 * via `run`'s return value but DO NOT break the chain — the next
 * acquirer runs as usual.
 */
export interface Mutex {
  /**
   * Run a critical section serialized against all other `run()`
   * calls on the same mutex. Returns whatever `fn` returns.
   */
  run<T>(fn: () => Promise<T>): Promise<T>;
}

export function createMutex(): Mutex {
  // The "tail" of the queue: a promise that resolves when the
  // currently-running (or last-enqueued) critical section is done.
  // Each new acquirer awaits this promise, then replaces it with
  // its own completion promise so the NEXT acquirer waits on them.
  //
  // This variable is mutated ONLY synchronously at the top of `run`,
  // which is why a non-lock-free assignment is safe: JavaScript is
  // single-threaded, and the sync prefix of an async function runs
  // atomically inside a microtask slot before yielding on the first
  // `await`.
  let tail: Promise<void> = Promise.resolve();

  return {
    async run<T>(fn: () => Promise<T>): Promise<T> {
      // Capture the current tail synchronously and replace it with
      // our own completion promise. These two lines must run atomically
      // with no `await` between them — they do, because they're the
      // sync prefix of the async function body.
      const prev = tail;
      let release!: () => void;
      const mine = new Promise<void>((resolve) => {
        release = resolve;
      });
      tail = mine;

      try {
        // Wait for the previous critical section to finish. Because
        // `mine` was built from a resolver that never rejects, the
        // chain of tails can never enter a rejected state — so
        // `await prev` always succeeds.
        await prev;
        return await fn();
      } finally {
        // Release the next waiter unconditionally, even if `fn`
        // threw. Without this the chain would deadlock on the first
        // error, which is very much not what we want.
        release();
      }
    },
  };
}
