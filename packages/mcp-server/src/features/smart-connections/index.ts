import { makeRequest, type ToolRegistry } from "$/shared";
import { type } from "arktype";
import { LocalRestAPI } from "shared";
import type { ObsidianMcpServer } from "../core"; // Import ObsidianMcpServer

export function registerSmartConnectionsTools(tools: ToolRegistry, obsServer: ObsidianMcpServer) { // Modified signature
  const vaultConfigProvider = obsServer.getVaultConfig.bind(obsServer); // Get vaultConfigProvider

  tools.register(
    type({
      name: '"search_vault_smart"',
      arguments: {
        vaultId: "string>0", // ADDED vaultId
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
    }).describe("Search for documents in a specific vault semantically matching a text string."), // Updated description
    async ({ arguments: args }) => {
      const { vaultId, ...searchBodyArgs } = args; // Extract vaultId, rest is body

      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiSmartSearchResponse,
        `/search/smart`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
          body: JSON.stringify(searchBodyArgs), // Pass remaining args as body
          headers: { "Content-Type": "application/json" } // Ensure Content-Type
        },
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(data, null, 2) },
          { type: "text", text: `Vault used: ${vaultId}` }
        ],
      };
    },
  );
}
