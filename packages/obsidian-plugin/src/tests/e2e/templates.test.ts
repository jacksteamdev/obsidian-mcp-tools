import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchLocalApi } from "./utils";

const TEMPLATE_ID = "Templates/test-template.md";
const TEMPLATE_CONTENT = `# Test Template
<% tp.mcpTools.prompt("one") %>
<% tp.mcpTools.prompt("two") %>`.trim();

async function createTestTemplate(): Promise<void> {
  const response = await fetchLocalApi(`/vault/${TEMPLATE_ID}`, {
    method: "PUT",
    body: TEMPLATE_CONTENT,
  });

  if (![204, 404].includes(response.status)) {
    const message = `Failed to delete test document: ${response.status}`;
    throw new Error(message);
  }
}

async function deleteTestTemplate(): Promise<void> {
  const response = await fetchLocalApi(`/vault/Templates/${TEMPLATE_ID}`, {
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
  beforeEach(deleteTestTemplate);
  beforeEach(createTestTemplate);
  afterEach(deleteTestTemplate);

  test("POST /templates/execute", async () => {
    const response = await fetchLocalApi("/templates/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: TEMPLATE_ID,
        arguments: {
          one: "Hello",
          two: "World",
        },
        createFile: false,
      }),
    });

    if (!response.ok) {
      const cause = await response.json();
      const message = `Request failed with status: ${response.status}`;
      throw new Error(message, { cause });
    }

    const data = await response.json();
    expect(data).toHaveProperty("message");
    expect(data).toHaveProperty("content");
    expect(typeof data.content).toBe("string");
  });
});
