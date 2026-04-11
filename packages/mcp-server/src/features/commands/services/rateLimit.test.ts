import { describe, expect, test } from "bun:test";
import { createRateLimiter } from "./rateLimit";

describe("createRateLimiter", () => {
  test("allows calls up to the limit within a single window", () => {
    const check = createRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });

    expect(check()).toBe(true);
    expect(check()).toBe(true);
    expect(check()).toBe(true);
    // Fourth call in the same window is refused.
    expect(check()).toBe(false);
  });

  test("resets the counter when a new window begins", () => {
    // Advanceable fake clock so we can step across window boundaries.
    let fakeNow = 0;
    const check = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => fakeNow,
    });

    // Exhaust the first window.
    expect(check()).toBe(true);
    expect(check()).toBe(true);
    expect(check()).toBe(false);

    // Cross into the next window: counter resets.
    fakeNow = 1000;
    expect(check()).toBe(true);
    expect(check()).toBe(true);
    expect(check()).toBe(false);
  });

  test("treats time within the same bucket as the same window", () => {
    // Calls at 0ms, 500ms, and 999ms all land in the first bucket
    // (Math.floor(t / 1000) * 1000 === 0). The 1000ms mark is the
    // start of a new bucket.
    let fakeNow = 0;
    const check = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => fakeNow,
    });

    fakeNow = 0;
    expect(check()).toBe(true);
    fakeNow = 500;
    expect(check()).toBe(true);
    fakeNow = 999;
    // Still in bucket 0 — limit reached, this call is refused.
    expect(check()).toBe(false);

    // Transition to bucket 1000.
    fakeNow = 1000;
    expect(check()).toBe(true);
  });

  test("honors a skipped window (no calls) without getting confused", () => {
    // If a limiter sees no traffic for several windows, the next call
    // should simply land in whatever the current bucket is, starting
    // its count from 1. The closure must not assume monotonic window
    // transitions by 1.
    let fakeNow = 0;
    const check = createRateLimiter({
      limit: 2,
      windowMs: 1000,
      now: () => fakeNow,
    });

    // First call at t=0.
    expect(check()).toBe(true);

    // Skip to t=5000 — four windows later.
    fakeNow = 5000;
    expect(check()).toBe(true);
    expect(check()).toBe(true);
    expect(check()).toBe(false);
  });

  test("uses sane defaults when no options are passed", () => {
    // Smoke test: a default limiter (limit=100, windowMs=60_000)
    // should accept the first call without throwing. We cannot
    // reasonably exercise the 100-call limit here without 100 calls,
    // so the assertion is that a fresh limiter is immediately usable.
    const check = createRateLimiter();
    expect(check()).toBe(true);
  });
});
