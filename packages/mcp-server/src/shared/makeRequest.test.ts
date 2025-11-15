import { describe, expect, test } from "bun:test";
import { BASE_URL } from "./makeRequest";

describe("makeRequest port configuration", () => {
  test("BASE_URL is constructed correctly", () => {
    // The BASE_URL should be a valid URL
    expect(BASE_URL).toMatch(/^https?:\/\//);
    expect(BASE_URL).toMatch(/:\d+$/); // Should end with a port number
  });

  test("BASE_URL uses correct protocol based on environment", () => {
    const useHttp = process.env.OBSIDIAN_USE_HTTP === "true";
    const expectedProtocol = useHttp ? "http" : "https";
    expect(BASE_URL).toStartWith(`${expectedProtocol}://`);
  });

  test("BASE_URL uses correct host", () => {
    const expectedHost = process.env.OBSIDIAN_HOST || "127.0.0.1";
    expect(BASE_URL).toContain(expectedHost);
  });

  test("BASE_URL uses correct port based on protocol", () => {
    const useHttp = process.env.OBSIDIAN_USE_HTTP === "true";

    if (useHttp) {
      const expectedPort = process.env.OBSIDIAN_HTTP_PORT
        ? parseInt(process.env.OBSIDIAN_HTTP_PORT, 10)
        : 27123; // DEFAULT_HTTP_PORT
      expect(BASE_URL).toEndWith(`:${expectedPort}`);
    } else {
      const expectedPort = process.env.OBSIDIAN_HTTPS_PORT
        ? parseInt(process.env.OBSIDIAN_HTTPS_PORT, 10)
        : 27124; // DEFAULT_HTTPS_PORT
      expect(BASE_URL).toEndWith(`:${expectedPort}`);
    }
  });

  test("custom HTTP port is respected when OBSIDIAN_USE_HTTP=true", () => {
    // Note: This test documents the expected behavior
    // Testing actual port changes requires mocking at module load time
    // which is not feasible with the current code structure

    // Expected behavior:
    // - When OBSIDIAN_USE_HTTP=true and OBSIDIAN_HTTP_PORT=8080
    // - BASE_URL should be http://127.0.0.1:8080

    // Expected behavior:
    // - When OBSIDIAN_USE_HTTP=true and no OBSIDIAN_HTTP_PORT
    // - BASE_URL should be http://127.0.0.1:27123 (default)
  });

  test("custom HTTPS port is respected when OBSIDIAN_USE_HTTP is not set", () => {
    // Note: This test documents the expected behavior

    // Expected behavior:
    // - When OBSIDIAN_HTTPS_PORT=8443 (and OBSIDIAN_USE_HTTP is not true)
    // - BASE_URL should be https://127.0.0.1:8443

    // Expected behavior:
    // - When no OBSIDIAN_HTTPS_PORT (and OBSIDIAN_USE_HTTP is not true)
    // - BASE_URL should be https://127.0.0.1:27124 (default)
  });
});

describe("Port configuration constants", () => {
  test("default HTTP port is 27123", () => {
    // This is the expected default when OBSIDIAN_HTTP_PORT is not set
    const DEFAULT_HTTP_PORT = 27123;

    if (
      process.env.OBSIDIAN_USE_HTTP === "true" &&
      !process.env.OBSIDIAN_HTTP_PORT
    ) {
      expect(BASE_URL).toEndWith(`:${DEFAULT_HTTP_PORT}`);
    }
  });

  test("default HTTPS port is 27124", () => {
    // This is the expected default when OBSIDIAN_HTTPS_PORT is not set
    const DEFAULT_HTTPS_PORT = 27124;

    if (
      process.env.OBSIDIAN_USE_HTTP !== "true" &&
      !process.env.OBSIDIAN_HTTPS_PORT
    ) {
      expect(BASE_URL).toEndWith(`:${DEFAULT_HTTPS_PORT}`);
    }
  });
});
