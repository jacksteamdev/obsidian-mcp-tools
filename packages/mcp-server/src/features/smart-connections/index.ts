import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

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
      // Note: Content-Type must be application/json for the plugin-side
      // handler to parse req.body via Express's bodyParser.json(). The
      // default Content-Type in makeRequest is text/markdown (correct for
      // the file-content endpoints), which would make the search handler
      // see an empty req.body and return an error.
      const data = await makeRequest(
        LocalRestAPI.ApiSmartSearchResponse,
        `/search/smart`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(args),
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
