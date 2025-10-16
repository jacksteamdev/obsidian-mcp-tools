import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Subprocess } from "bun";

describe("HTTP Server E2E Tests", () => {
  let serverProcess: Subprocess;
  const PORT = 3001;
  const BASE_URL = `http://localhost:${PORT}`;

  beforeAll(async () => {
    // Start the server in a subprocess
    serverProcess = Bun.spawn(["bun", "src/index.ts"], {
      env: {
        ...process.env,
        OBSIDIAN_API_KEY: "test-key-e2e",
        PORT: String(PORT),
      },
      stdout: "pipe",
      stderr: "pipe",
    });

    // Wait for server to be ready
    let retries = 20;
    while (retries > 0) {
      try {
        const response = await fetch(`${BASE_URL}/health`);
        if (response.ok) {
          break;
        }
      } catch {
        // Server not ready yet
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
      retries--;
    }

    if (retries === 0) {
      throw new Error("Server failed to start within timeout");
    }
  });

  afterAll(() => {
    serverProcess.kill();
  });

  describe("Health endpoint", () => {
    test("should return 200 status", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.status).toBe(200);
    });

    test("should return correct health status", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      const data = await response.json();

      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("version");
      expect(typeof data.version).toBe("string");
    });

    test("should have correct content-type header", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
    });
  });

  describe("SSE endpoint", () => {
    test("should accept GET requests", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);

      try {
        const response = await fetch(`${BASE_URL}/sse`, {
          signal: controller.signal,
        });

        expect(response.status).toBe(200);
        expect(response.headers.get("content-type")).toContain("text/event-stream");
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          // Expected - we aborted the connection
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    });

    test("should send SSE endpoint message", async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      try {
        const response = await fetch(`${BASE_URL}/sse`, {
          signal: controller.signal,
        });

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let receivedEndpoint = false;

        // Read initial SSE messages
        for (let i = 0; i < 5; i++) {
          const { value, done } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          if (text.includes("event: endpoint")) {
            receivedEndpoint = true;
            break;
          }
        }

        expect(receivedEndpoint).toBe(true);
      } catch (error: unknown) {
        if (error instanceof Error && error.name === "AbortError") {
          // Expected - we aborted the connection
        } else {
          throw error;
        }
      } finally {
        clearTimeout(timeout);
      }
    });
  });

  describe("POST message endpoint", () => {
    test("should return 400 for missing sessionId", async () => {
      const response = await fetch(`${BASE_URL}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "test", id: 1 }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("sessionId");
    });

    test("should return 404 for invalid sessionId", async () => {
      const response = await fetch(
        `${BASE_URL}/message?sessionId=invalid-session-id`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", method: "test", id: 1 }),
        },
      );

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data).toHaveProperty("error");
      expect(data.error).toContain("Session not found");
    });
  });

  describe("CORS", () => {
    test("should include CORS headers", async () => {
      const response = await fetch(`${BASE_URL}/health`);
      expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
    });

    test("should handle OPTIONS preflight requests", async () => {
      const response = await fetch(`${BASE_URL}/health`, {
        method: "OPTIONS",
      });

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeTruthy();
      expect(response.headers.get("access-control-allow-methods")).toBeTruthy();
    });
  });

  describe("Error handling", () => {
    test("should return 404 for unknown routes", async () => {
      const response = await fetch(`${BASE_URL}/unknown-route`);
      expect(response.status).toBe(404);
    });
  });
});
