import { describe, expect, test } from "bun:test";
import { searchResponse } from "shared";

declare global {
  interface RequestInit {
    /** This is a Bun-specific feature and not available in the NodeJS runtime */
    tls?: {
      /** Allow self-signed certificates if false */
      rejectUnauthorized: boolean;
    };
  }
}

export const fetchLocalApi = (path: string, init?: RequestInit) =>
  fetch(`https://localhost:27124${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.OBSIDIAN_API_KEY}`,
      ...init?.headers,
    },
    tls: {
      rejectUnauthorized: false,
      ...init?.tls,
    },
  });

/**
 * These tests are a sanity check, running against the Obsidian desktop app on the local machine. They are not intended to be run in CI.
 */
describe.if(process.env.NODE_ENV === "test-e2e")("Obsidian REST API", () => {
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

  test.todo("POST /sources/search");
  test.todo("GET /sources/:documentId");
  test.todo("PUT /sources/:documentId");
  test.todo("POST /templates/execute");
});
