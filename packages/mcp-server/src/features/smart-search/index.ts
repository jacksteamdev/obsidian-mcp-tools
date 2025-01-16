import { formatMcpError, makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI, type SetupFunctionResult } from "shared";

export async function setup(tools: ToolRegistry): SetupFunctionResult {
  try {
    tools.register(
      type({
        name: '"search_vault_smart"',
        arguments: {
          query: type("string>0").describe(
            "A search phrase for semantic search",
          ),
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

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,
      error: formatMcpError(error).message,
    };
  }
}
