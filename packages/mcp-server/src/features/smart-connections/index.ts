import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

/**
 * Build the fetch options for the `/search/smart` POST call. Extracted as
 * a pure helper so the load-bearing `Content-Type: application/json`
 * header can be pinned by a unit test without touching the network.
 *
 * Why the explicit header: `makeRequest`'s default Content-Type is
 * `text/markdown` (correct for the file-content endpoints). The plugin
 * side of `/search/smart` parses `req.body` via Express's
 * `bodyParser.json()`, which only activates for requests whose
 * Content-Type matches `application/json`. Under the default header the
 * handler sees an empty `req.body` and every semantic search fails
 * silently. See upstream issue #39.
 *
 * Exported for unit testing.
 */
export function buildSmartSearchRequestOptions(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function registerSmartConnectionsTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"search_vault_smart"',
      arguments: {
        query: type("string>0").describe("A search phrase for semantic search"),
        "filter?": {
          "folders?": type("string[]").describe(
            'An array of folder names to include. For example, ["Public", "Work"]',
          ),
          "excludeFolders?": type("string[]").describe(
            'An array of folder names to exclude. For example, ["Private", "Archive"]',
          ),
          "limit?": type("number>0").describe(
            "The maximum number of results to return",
          ),
        },
      },
    }).describe("Search for documents semantically matching a text string."),
    async ({ arguments: args }) => {
      const data = await makeRequest(
        LocalRestAPI.ApiSmartSearchResponse,
        `/search/smart`,
        buildSmartSearchRequestOptions(args),
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
