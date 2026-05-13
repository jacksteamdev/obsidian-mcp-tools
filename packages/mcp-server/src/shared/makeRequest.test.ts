import { describe, expect, test } from "bun:test";
import { resolveBaseUrl } from "./makeRequest";

describe("resolveBaseUrl", () => {
  test("defaults to the Local REST API HTTPS port", () => {
    expect(resolveBaseUrl({})).toBe("https://127.0.0.1:27124");
  });

  test("uses the default HTTP port when HTTP is enabled", () => {
    expect(resolveBaseUrl({ OBSIDIAN_USE_HTTP: "true" })).toBe(
      "http://127.0.0.1:27123",
    );
  });

  test("uses custom HTTP and HTTPS ports", () => {
    expect(
      resolveBaseUrl({
        OBSIDIAN_USE_HTTP: "true",
        OBSIDIAN_HTTP_PORT: "27125",
      }),
    ).toBe("http://127.0.0.1:27125");

    expect(resolveBaseUrl({ OBSIDIAN_HTTPS_PORT: "27126" })).toBe(
      "https://127.0.0.1:27126",
    );
  });

  test("uses base URL override before host, protocol, and port fields", () => {
    expect(
      resolveBaseUrl({
        OBSIDIAN_BASE_URL: "http://127.0.0.1:3000/",
        OBSIDIAN_USE_HTTP: "false",
        OBSIDIAN_HTTPS_PORT: "27126",
      }),
    ).toBe("http://127.0.0.1:3000");
  });
});
