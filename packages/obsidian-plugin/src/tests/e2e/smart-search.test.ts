import { describe, test } from "bun:test";
import { searchResponse } from "shared";
import { fetchLocalApi } from "./utils";

/**
 * These tests are a sanity check, running against the Obsidian desktop app on the local machine. They are not intended to run in CI.
 */
describe.if(process.env.NODE_ENV === "test-api")("Obsidian REST API", () => {
  test("POST /search/smart", async () => {
    const response = await fetchLocalApi("/search/smart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "test",
      }),
    });

    if (!response.ok) {
      const cause = await response.json();
      const message = `Request failed with status: ${response.status}`;
      throw new Error(message, { cause });
    }

    const data = await response.json();
    searchResponse.assert(data);
  });
});
