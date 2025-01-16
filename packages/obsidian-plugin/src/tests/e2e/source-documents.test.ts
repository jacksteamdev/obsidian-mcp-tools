import { sourceDocumentSearchResult } from "$/features/source-documents/types";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { pageResponseSchema, type DocumentMetadata } from "shared";
import { fetchLocalApi } from "./utils";
import { type } from "arktype";

const DOCUMENT_ID = "test.com/test-document";

async function deleteTestDocument(): Promise<void> {
  const response = await fetchLocalApi(`/vault/Sources/${DOCUMENT_ID}.md`, {
    method: "DELETE",
  });

  if (![204, 404].includes(response.status)) {
    const message = `Failed to delete test document: ${response.status}`;
    throw new Error(message);
  }
}

/**
 * These tests are a sanity check, running against the Obsidian desktop app on the local machine. They are not intended to be run in CI.
 */
describe.if(process.env.NODE_ENV === "test-api")("Obsidian REST API", () => {
  beforeAll(deleteTestDocument);
  afterAll(deleteTestDocument);

  test("PUT /sources/:origin/:id", async () => {
    const metadata: DocumentMetadata = {
      canonicalUrl: "https://superb-starlight-b5acb5.netlify.app/",
      title: "Understanding Express Routes A Complete Guide",
      author: "Jane Doe",
    };
    const content = `# Test Content`;

    const response = await fetchLocalApi(`/sources/${DOCUMENT_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        metadata,
        content,
      }),
    });

    if (!response.ok) {
      const cause = await response.json();
      const message = `Request failed with status: ${response.status}`;
      throw new Error(message, {
        cause: {
          url: response.url,
          cause,
        },
      });
    }

    const data = await response.json();

    const { message, content: result } = type({
      message: "string",
      content: "string",
    }).assert(data);

    expect(message).toBe("Source document created successfully");
    Object.values({ ...metadata, content }).forEach((value) => {
      expect(result).toInclude(value);
    });
  });

  test("GET /sources/:origin/:id", async () => {
    const response = await fetchLocalApi(`/sources/${DOCUMENT_ID}`);

    if (!response.ok) {
      const cause = await response.json();
      const message = `Request failed with status: ${response.status}`;
      throw new Error(message, { cause });
    }

    const data = await response.json();
    pageResponseSchema.assert(data);
  });

  test("POST /sources/search", async () => {
    const response = await fetchLocalApi("/sources/search", {
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
    sourceDocumentSearchResult.array().assert(data);
  });
});
