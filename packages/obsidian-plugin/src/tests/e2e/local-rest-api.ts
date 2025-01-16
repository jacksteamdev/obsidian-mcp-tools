import { describe, expect, test } from "bun:test";
import { fetchLocalApi } from "./utils";

/**
 * These tests are a sanity check, running against the Obsidian desktop app on the local machine. They are not intended to be run in CI.
 */
describe.if(process.env.NODE_ENV === "test-api")("Obsidian REST API", () => {
  test("GET /", async () => {
    const response = await fetchLocalApi("/");

    if (!response.ok) {
      const cause = await response.json();
      const message = `Request failed with status: ${response.status}`;
      throw new Error(message, { cause });
    }

    const data = await response.json();
    expect(data).toHaveProperty("status", "OK");
    expect(data).toHaveProperty("versions");
  });
});
