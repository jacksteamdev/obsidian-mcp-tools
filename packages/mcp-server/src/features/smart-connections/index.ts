import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

export function registerSmartConnectionsTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"search_vault_smart"',
      arguments: {
        query: type("string>0").describe(
          "A search phrase for semantic search. REQUIRED.",
        ),
        "filter?": {
          "folders?": type("string[]").describe(
            "An array of folder names to include. For example, ['Public', 'Work']. Optional.",
          ),
          "excludeFolders?": type("string[]").describe(
            "An array of folder names to exclude. For example, ['Private', 'Archive']. Optional.",
          ),
          "limit?": type("number>0").describe(
            "The maximum number of results to return. Optional.",
          ),
        },
      },
    }).describe(
      "Search for documents semantically matching a text string. " +
        "IMPORTANT: The 'query' argument is required. " +
        "Example: { query: 'meeting notes about project planning', filter: { folders: ['Work'], limit: 10 } }",
    ),
    async ({ arguments: args }) => {
      const data = await makeRequest(
        LocalRestAPI.ApiSmartSearchResponse,
        `/search/smart`,
        {
          method: "POST",
          body: JSON.stringify(args),
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );
}
