import { describe, expect, it, beforeEach, afterEach, mock } from "bun:test";

describe("makeRequest TLS scoping", () => {
  const originalTLS = process.env.NODE_TLS_REJECT_UNAUTHORIZED;

  beforeEach(() => {
    // Ensure clean state before each test
    delete (process.env as Record<string, string | undefined>).NODE_TLS_REJECT_UNAUTHORIZED;
  });

  afterEach(() => {
    // Restore original value
    if (originalTLS === undefined) {
      delete (process.env as Record<string, string | undefined>).NODE_TLS_REJECT_UNAUTHORIZED;
    } else {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalTLS;
    }
  });

  it("should NOT have TLS globally disabled after module import", async () => {
    // Re-import to verify module-level side effects
    // After the fix, importing the module should NOT set NODE_TLS_REJECT_UNAUTHORIZED
    delete (process.env as Record<string, string | undefined>).NODE_TLS_REJECT_UNAUTHORIZED;

    // Dynamic import to get a fresh evaluation
    await import("./makeRequest");

    // After fix: the env var should NOT be set at module level
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("should restore TLS env var after makeRequest completes", async () => {
    process.env.OBSIDIAN_API_KEY = "test-key";
    delete (process.env as Record<string, string | undefined>).NODE_TLS_REJECT_UNAUTHORIZED;

    const { makeRequest } = await import("./makeRequest");

    // Mock fetch to avoid actual network calls
    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    ) as unknown as typeof fetch;

    try {
      const { type } = await import("arktype");
      await makeRequest(type("string"), "/test");
    } catch {
      // We don't care about the result, just the TLS state
    } finally {
      globalThis.fetch = originalFetch;
    }

    // After makeRequest completes, TLS should be restored
    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBeUndefined();
  });

  it("should restore previous TLS value after makeRequest", async () => {
    process.env.OBSIDIAN_API_KEY = "test-key";
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "1";

    const { makeRequest } = await import("./makeRequest");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = mock(() =>
      Promise.resolve(new Response("ok", { status: 200 })),
    ) as unknown as typeof fetch;

    try {
      const { type } = await import("arktype");
      await makeRequest(type("string"), "/test");
    } catch {
      // ignore
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(process.env.NODE_TLS_REJECT_UNAUTHORIZED).toBe("1");
  });
});

describe("makeRequest error logging", () => {
  it("should NOT include process.env in error logging", async () => {
    // This is a code review assertion - verified by reading the source
    const fs = await import("fs");
    const source = fs.readFileSync(
      new URL("./makeRequest.ts", import.meta.url).pathname,
      "utf-8",
    );
    expect(source).not.toContain("env: process.env");
  });
});
