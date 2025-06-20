import {
  formatMcpError,
  makeRequest,
  parseTemplateParameters,
  type ToolRegistry,
} from "$/shared";
import { type } from "arktype";
import { buildTemplateArgumentsSchema, LocalRestAPI } from "shared";
import type { ObsidianMcpServer } from "../core"; // Import ObsidianMcpServer

export function registerTemplaterTools(tools: ToolRegistry, obsServer: ObsidianMcpServer) { // Modified signature
  const vaultConfigProvider = obsServer.getVaultConfig.bind(obsServer); // Get vaultConfigProvider

  tools.register(
    type({
      name: '"execute_template"',
      arguments: LocalRestAPI.ApiTemplateExecutionParams.omit("createFile").and(
        {
          vaultId: "string>0", // ADDED vaultId
          // should be boolean but the MCP client returns a string
          "createFile?": type("'true'|'false'"),
        },
      ),
    }).describe("Execute a Templater template in a specific vault with the given arguments"), // Updated description
    async ({ arguments: args }) => {
      const { vaultId, ...templateArgsForRest } = args; // Extract vaultId

      // Get template content from the specified vault
      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoteJson, // Expect ApiNoteJson for .content
        `/vault/${templateArgsForRest.name}`, // Use name from remaining args
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON },
        },
      ) as LocalRestAPI.ApiNoteJsonType; // Cast for type safety

      // Validate prompt arguments
      const templateParameters = parseTemplateParameters(data.content || ""); // Add null check for content
      const validArgs = buildTemplateArgumentsSchema(templateParameters)(
        templateArgsForRest.arguments, // Use arguments from remaining args
      );
      if (validArgs instanceof type.errors) {
        throw formatMcpError(validArgs);
      }

      // Prepare arguments for the target Local REST API's /templates/execute endpoint
      // This body should NOT contain vaultId.
      const finalTemplateExecutionArgs: LocalRestAPI.ApiTemplateExecutionParamsType = {
        name: templateArgsForRest.name,
        arguments: validArgs,
        createFile: templateArgsForRest.createFile === "true",
        targetPath: templateArgsForRest.targetPath,
      };
      
      // Process template through Templater plugin via the specified vault's Local REST API
      const response = await makeRequest(
        vaultId, // This vaultId directs makeRequest to the correct vault's Local REST API
        LocalRestAPI.ApiTemplateExecutionResponse,
        "/templates/execute", // Path on the target vault's Local REST API
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalTemplateExecutionArgs),
        },
      );

      return {
        content: [
          { type: "text", text: JSON.stringify(response, null, 2) },
          { type: "text", text: `Vault used: ${vaultId}` }
        ],
      };
    },
  );
}
