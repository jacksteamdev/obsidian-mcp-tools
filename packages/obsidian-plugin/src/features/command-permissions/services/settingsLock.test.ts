import { describe, expect, test } from "bun:test";
import { createMutex } from "./settingsLock";

/**
 * Tests for the async mutex used to serialize command-permission
 * settings writes. These are pure and don't touch Obsidian — the
 * mutex is a small standalone primitive that happens to be used by
 * the handler.
 */
describe("createMutex", () => {
  test("serializes concurrent sections in FIFO order", async () => {
    // Three sections with intentionally inverted sleep durations:
    // section 1 is the longest, section 3 is the shortest. Without
    // the mutex they would interleave (3 would finish first). With
    // the mutex, they MUST run strictly in enqueue order.
    const mutex = createMutex();
    const events: string[] = [];

    const section = (id: number, sleepMs: number) => async () => {
      events.push(`${id}-start`);
      await new Promise((r) => setTimeout(r, sleepMs));
      events.push(`${id}-end`);
      return id;
    };

    const results = await Promise.all([
      mutex.run(section(1, 25)),
      mutex.run(section(2, 10)),
      mutex.run(section(3, 2)),
    ]);

    expect(results).toEqual([1, 2, 3]);
    // No interleaving: each section's end appears before the next
    // section's start.
    expect(events).toEqual([
      "1-start",
      "1-end",
      "2-start",
      "2-end",
      "3-start",
      "3-end",
    ]);
  });

  test("continues processing the queue when an earlier section throws", async () => {
    // A failing section must NOT break the chain — subsequent
    // sections should still run. This is load-bearing for the
    // command-permission handler: if a saveData() call fails for
    // one request, the next request's save should still succeed.
    const mutex = createMutex();
    const events: number[] = [];

    const section = (id: number, shouldThrow: boolean) => async () => {
      events.push(id);
      if (shouldThrow) throw new Error(`boom-${id}`);
      return id;
    };

    const results = await Promise.allSettled([
      mutex.run(section(1, false)),
      mutex.run(section(2, true)),
      mutex.run(section(3, false)),
    ]);

    // All three ran in FIFO order.
    expect(events).toEqual([1, 2, 3]);
    expect(results[0]).toEqual({ status: "fulfilled", value: 1 });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: 3 });
  });

  test("distinct mutex instances don't block each other", async () => {
    // A second mutex must be completely independent. This is the
    // reason the mutex is a local instance (not a module-level
    // singleton): if the command-permission handler ever shares a
    // process with another feature that also uses a mutex, they
    // must not interfere.
    const m1 = createMutex();
    const m2 = createMutex();
    const events: string[] = [];

    await Promise.all([
      m1.run(async () => {
        events.push("m1-start");
        await new Promise((r) => setTimeout(r, 30));
        events.push("m1-end");
      }),
      m2.run(async () => {
        events.push("m2-start");
        await new Promise((r) => setTimeout(r, 5));
        events.push("m2-end");
      }),
    ]);

    // Both mutexes started at roughly the same time. m2's section is
    // short (5ms), m1's is long (30ms), so m2 should complete first.
    expect(events).toEqual(["m1-start", "m2-start", "m2-end", "m1-end"]);
  });

  test("propagates the return value of the critical section", async () => {
    const mutex = createMutex();
    const result = await mutex.run(async () => ({ answer: 42 }));
    expect(result).toEqual({ answer: 42 });
  });

  test("propagates errors to the caller while keeping the mutex usable", async () => {
    const mutex = createMutex();

    await expect(
      mutex.run(async () => {
        throw new Error("crash");
      }),
    ).rejects.toThrow("crash");

    // After the error, a fresh acquirer must run as usual.
    const result = await mutex.run(async () => "ok");
    expect(result).toBe("ok");
  });

  test("chains correctly when many acquirers arrive in the same tick", async () => {
    // This is the actual regression guard for the race condition
    // Fase 2 exposed: 35 parallel calls in the same microtask slot
    // must all go through the critical section exactly once, in the
    // order they were enqueued.
    const mutex = createMutex();
    const order: number[] = [];

    const runs = Array.from({ length: 35 }, (_, i) =>
      mutex.run(async () => {
        order.push(i);
        // A tiny async pause inside the section to force the JS
        // scheduler to actually context-switch. If serialization is
        // broken, other sections will slip in here.
        await Promise.resolve();
        // Sanity: when my section is running, I must be the *last*
        // entry in `order`.
        expect(order[order.length - 1]).toBe(i);
      }),
    );
    await Promise.all(runs);

    // All 35 must have executed, in the exact enqueue order.
    expect(order).toEqual(Array.from({ length: 35 }, (_, i) => i));
  });
});
