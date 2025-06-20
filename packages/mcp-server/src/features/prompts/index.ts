import {
  formatMcpError,
  logger,
  makeRequest,
  parseTemplateParameters,
} from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import {
  buildTemplateArgumentsSchema,
  LocalRestAPI,
  PromptFrontmatterSchema,
  type PromptMetadata,
} from "shared";
import type { ObsidianMcpServer } from "../core"; // Import ObsidianMcpServer

const PROMPT_DIRNAME = `Prompts`;

const GLOBAL_PROMPTS: Record<string, PromptMetadata> = {
  "list_configured_vaults": {
    name: "list_configured_vaults",
    description: "Displays a list of all Obsidian vaults currently configured and accessible by this server.",
    arguments: [], // No arguments needed
  },
  // Add other global prompts here if needed
};

export function setupObsidianPrompts(server: Server, obsServer: ObsidianMcpServer) {
  const vaultConfigProvider = obsServer.getVaultConfig.bind(obsServer);

  server.setRequestHandler(ListPromptsRequestSchema, async ({ params }) => {
    try {
      const requestedVaultId = (params as any)?.vaultId || (params as any)?.arguments?.vaultId;
      let promptsToShow: PromptMetadata[] = [...Object.values(GLOBAL_PROMPTS)]; // Start with global prompts

      const processVault = async (vaultId: string, prefixName = false): Promise<PromptMetadata[]> => {
        try {
          const { files } = await makeRequest(
            vaultId,
            LocalRestAPI.ApiVaultDirectoryResponse,
            `/vault/${PROMPT_DIRNAME}/`,
            vaultConfigProvider
          );
          const fileList = (files as string[]) || [];
          const vaultPromptsPromises = fileList.map(async (filename) => {
            if (!filename.endsWith(".md")) return null;

            const file = await makeRequest(
              vaultId,
              LocalRestAPI.ApiNoteJson,
              `/vault/${PROMPT_DIRNAME}/${filename}`,
              vaultConfigProvider,
              { headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON } },
            ) as LocalRestAPI.ApiNoteJsonType;

            if (!file.tags || !file.tags.includes("mcp-tools-prompt")) return null;
            
            const promptName = prefixName ? `${vaultId}/${filename}` : filename;
            return {
              name: promptName,
              description: file.frontmatter?.description || "",
              arguments: parseTemplateParameters(file.content || ""),
            };
          });
          const resolvedPrompts = await Promise.all(vaultPromptsPromises);
          return resolvedPrompts.filter(p => p !== null) as PromptMetadata[];
        } catch (vaultError: any) {
          const errorMessage = String(vaultError?.message || vaultError || "").toLowerCase();
          // Check for common indicators of a "Not Found" error from Local REST API or fetch.
          // The Local REST API might return a specific message or status that makeRequest translates.
          const isNotFoundError = 
            errorMessage.includes("404") ||
            errorMessage.includes("not found") ||
            errorMessage.includes("no such file or directory");

          if (isNotFoundError) {
            logger.debug(`'Prompts' directory not found in vault ${vaultId} or error listing its contents (likely 404). No file-based prompts will be loaded from this vault. Error details: ${String(vaultError)}`);
          } else {
            logger.warn(`Failed to list prompts for vault ${vaultId}. This could be due to Local REST API issues, incorrect permissions, or other errors not related to a missing directory.`, { error: vaultError });
          }
          return []; // Return empty for this vault if any error occurs while listing directory contents
        }
      };

      if (requestedVaultId) {
        // If a specific vaultId is requested, get its prompts (names not prefixed)
        const vaultSpecificPrompts = await processVault(requestedVaultId, false);
        promptsToShow.push(...vaultSpecificPrompts);
      } else {
        // If no vaultId is requested, process all configured vaults (names prefixed)
        const allVaultConfigs = obsServer.getVaultsConfig();
        if (allVaultConfigs && allVaultConfigs.length > 0) {
          for (const vaultConfig of allVaultConfigs) {
            const vaultSpecificPrompts = await processVault(vaultConfig.vaultId, true);
            promptsToShow.push(...vaultSpecificPrompts);
          }
        } else {
          logger.info("ListPrompts called without vaultId and no vaults are configured on the server. Returning global prompts only.");
        }
      }
      
      return { prompts: promptsToShow };
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in ListPromptsRequestSchema handler (outer)", {
        error,
        message: error.message,
      });
      throw error;
    }
  });

  server.setRequestHandler(GetPromptRequestSchema, async ({ params }) => {
    try {
      const requestedPromptName = params.name;

      // Handle Global Prompts
      if (GLOBAL_PROMPTS[requestedPromptName]) {
        const globalPrompt = GLOBAL_PROMPTS[requestedPromptName];
        if (requestedPromptName === "list_configured_vaults") {
          const allVaultConfigs = obsServer.getVaultsConfig();
          const vaultListText = allVaultConfigs.map((vc, index) => 
            `${index + 1}. ID: ${vc.vaultId}\n   Name: ${vc.name}\n   Path: ${vc.path || 'N/A'}`
          ).join("\n\n");
          
          return {
            description: globalPrompt.description,
            messages: [{
              role: "assistant",
              content: { type: "text", text: `Configured vaults:\n\n${vaultListText || "No vaults configured."}` }
            }]
          };
        }
        // Handle other global prompts here if they have specific logic
        // For now, just return its definition if it's not list_configured_vaults
        return {
          description: globalPrompt.description,
          messages: [{ role: "system", content: { type: "text", text: `Global prompt '${globalPrompt.name}' selected. Implementation pending.`} }]
        };
      }

      // Handle Vault-Specific Prompts (potentially prefixed)
      let vaultIdToUse: string | undefined = (params.arguments as any)?.vaultId;
      let actualPromptName = requestedPromptName;

      if (!vaultIdToUse) {
        const parts = requestedPromptName.split('/');
        if (parts.length > 1) {
          // Check if the first part is a valid vaultId
          try {
            obsServer.getVaultConfig(parts[0]); // This will throw if parts[0] is not a valid vaultId
            vaultIdToUse = parts[0];
            actualPromptName = parts.slice(1).join('/');
            logger.debug(`Extracted vaultId '${vaultIdToUse}' and promptName '${actualPromptName}' from prefixed name.`);
          } catch {
            // parts[0] is not a valid vaultId, so assume requestedPromptName is not prefixed
            // and vaultId is genuinely missing.
          }
        }
      }
      
      if (!vaultIdToUse) {
        // This implies Claude Desktop (or other client) did not send vaultId in arguments,
        // and the prompt name was not a prefixed one from which we could infer a vaultId.
        // This also means no default vaultId was injected by Claude's config into params.arguments.
        throw new McpError(ErrorCode.InvalidRequest, `vaultId is required for vault-specific prompt '${actualPromptName}' and was not provided or inferable.`);
      }

      const promptFilePath = `${PROMPT_DIRNAME}/${actualPromptName}`;

      const fileData = await makeRequest(
        vaultIdToUse,
        LocalRestAPI.ApiNoteJson,
        `/vault/${promptFilePath}`,
        vaultConfigProvider,
        { headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON } },
      ) as LocalRestAPI.ApiNoteJsonType;

      const { description } = PromptFrontmatterSchema.assert(fileData.frontmatter || {});
      const templateParams = parseTemplateParameters(fileData.content || "");
      const templateParamsSchema = buildTemplateArgumentsSchema(templateParams);
      const templateArgs = templateParamsSchema(params.arguments);
      if (templateArgs instanceof type.errors) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid arguments: ${templateArgs.summary}`,
        );
      }

      const templateExecutionArgs: LocalRestAPI.ApiTemplateExecutionParamsType =
        {
          name: promptFilePath,
          arguments: templateArgs,
        };

      // Process template through Templater plugin
      // This makeRequest call is problematic as /templates/execute is an internal tool, not a Local REST API endpoint.
      // For now, making it syntactically correct for makeRequest, but this needs a proper fix (e.g. server.callTool).
      // const templateExecuteArgsWithVaultId = { ...templateExecutionArgs, vaultId: vaultIdToUse }; // Not needed as vaultIdToUse is passed directly to makeRequest
      const { content } = await makeRequest(
        vaultIdToUse, // Corrected: Use vaultIdToUse
        LocalRestAPI.ApiTemplateExecutionResponse, // Schema for the expected response
        "/templates/execute", // This is an internal MCP path
        vaultConfigProvider, // Passing for makeRequest signature, actual use is questionable here
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateExecutionArgs),
        },
      );

      // Using unsafe assertion b/c the last element is always a string
      const withoutFrontmatter = content.split("---").at(-1)!.trim();

      return {
        messages: [
          {
            description,
            role: "user",
            content: {
              type: "text",
              text: withoutFrontmatter,
            },
          },
        ],
      };
    } catch (err) {
      const error = formatMcpError(err);
      logger.error("Error in GetPromptRequestSchema handler", {
        error,
        message: error.message,
      });
      throw error;
    }
  });
}
