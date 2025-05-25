import { makeRequest, type ToolRegistry } from "$/shared";
// Import ObsidianMcpServer to access its getVaultConfig method
import type { ObsidianMcpServer } from "$/features/core";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

// Modify function to accept obsidianServer instance
export function registerLocalRestApiTools(tools: ToolRegistry, obsidianServer: ObsidianMcpServer) {
  const vaultConfigProvider = obsidianServer.getVaultConfig.bind(obsidianServer);

  // GET Status
  tools.register(
    type({
      name: '"get_server_info"',
      // Add vaultId to arguments
      arguments: { vaultId: "string>0" },
    }).describe(
      "Returns basic details about the Obsidian Local REST API and authentication status for a specific vault. This is the only API request that does not require authentication with the vault's API key, but vaultId is needed to target the correct Local REST API instance.",
    ),
    async ({ arguments: args }) => {
      // Extract vaultId
      const { vaultId } = args;
      // Call makeRequest with vaultId and vaultConfigProvider
      // Note: get_server_info might not strictly need the API key from vaultConfig for its specific endpoint,
      // but it needs the correct localRestApiBaseUrl from the vault's config.
      const data = await makeRequest(vaultId, LocalRestAPI.ApiStatusResponse, "/", vaultConfigProvider);
      return {
        content: [
          { type: "text", text: JSON.stringify(data, null, 2) },
          { type: "text", text: `Vault used: ${vaultId}` }
        ],
      };
    },
  );

  // GET Active File
  tools.register(
    type({
      name: '"get_active_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        format: type('"markdown" | "json"').optional(),
      },
    }).describe(
      "Returns the content of the currently active file in the specified Obsidian vault. Can return either markdown content or a JSON representation including parsed tags and frontmatter.",
    ),
    async ({ arguments: args }) => {
      const { vaultId } = args; // Extract vaultId
      const format =
        args?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";
      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoteJson.or("string"),
        "/active/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          headers: { Accept: format },
        },
      );
      const content =
        typeof data === "string" ? data : JSON.stringify(data, null, 2);
      return { content: [{ type: "text", text: content }] };
    },
  );

  // PUT Active File
  tools.register(
    type({
      name: '"update_active_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        content: "string",
      },
    }).describe("Update the content of the active file open in the specified Obsidian vault."),
    async ({ arguments: args }) => {
      const { vaultId, content } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        "/active/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "PUT",
          body: content,
        },
      );
      return {
        content: [{ type: "text", text: "File updated successfully" }],
      };
    },
  );

  // POST Active File
  tools.register(
    type({
      name: '"append_to_active_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        content: "string",
      },
    }).describe("Append content to the end of the currently-open note in the specified vault."),
    async ({ arguments: args }) => {
      const { vaultId, content } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        "/active/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
          body: content,
        },
      );
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Active File
  tools.register(
    type({
      name: '"patch_active_file"',
      // Add vaultId to the existing ApiPatchParameters
      arguments: type({ vaultId: "string>0" }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in the currently-open note in the specified vault, relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      const { vaultId, ...patchArgs } = args; // Extract vaultId, rest are patchArgs
      const headers: Record<string, string> = {
        Operation: patchArgs.operation,
        "Target-Type": patchArgs.targetType,
        Target: patchArgs.target,
        "Create-Target-If-Missing": "true",
      };

      if (patchArgs.targetDelimiter) {
        headers["Target-Delimiter"] = patchArgs.targetDelimiter;
      }
      if (patchArgs.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(patchArgs.trimTargetWhitespace);
      }
      if (patchArgs.contentType) {
        headers["Content-Type"] = patchArgs.contentType;
      }

      const response = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiContentResponse,
        "/active/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "PATCH",
          headers,
          body: patchArgs.content,
        },
      );
      // Ensure 'response' is a string before returning. If it's an object, stringify it.
      const responseText = typeof response === 'string' ? response : JSON.stringify(response);
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: responseText },
        ],
      };
    },
  );

  // DELETE Active File
  tools.register(
    type({
      name: '"delete_active_file"',
      arguments: { vaultId: "string>0" }, // Added vaultId
    }).describe("Delete the currently-active file in the specified Obsidian vault."),
    async ({ arguments: args }) => {
      const { vaultId } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        "/active/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "DELETE",
        },
      );
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );

  // POST Open File in Obsidian UI
  tools.register(
    type({
      name: '"show_file_in_obsidian"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        filename: "string",
        "newLeaf?": "boolean",
      },
    }).describe(
      "Open a document in the Obsidian UI for the specified vault. Creates a new document if it doesn't exist. Returns a confirmation if the file was opened successfully.",
    ),
    async ({ arguments: args }) => {
      const { vaultId, filename } = args; // Extract vaultId and filename
      const query = args.newLeaf ? "?newLeaf=true" : "";

      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        `/open/${encodeURIComponent(filename)}${query}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: "File opened successfully" }],
      };
    },
  );

  // POST Search via Dataview or JsonLogic
  tools.register(
    type({
      name: '"search_vault"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        queryType: '"dataview" | "jsonlogic"',
        query: "string",
      },
    }).describe(
      "Search for documents in the specified vault matching a query using either Dataview DQL or JsonLogic.",
    ),
    async ({ arguments: args }) => {
      const { vaultId, queryType, query } = args; // Extract vaultId
      const contentType =
        queryType === "dataview"
          ? "application/vnd.olrapi.dataview.dql+txt"
          : "application/vnd.olrapi.jsonlogic+json";

      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: query,
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // POST Simple Search
  tools.register(
    type({
      name: '"search_vault_simple"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        query: "string",
        "contextLength?": "number",
      },
    }).describe("Search for documents in the specified vault matching a text query."),
    async ({ arguments: args }) => {
      const { vaultId, ...searchArgs } = args; // Extract vaultId
      const queryParams = new URLSearchParams({
        query: searchArgs.query,
        ...(searchArgs.contextLength
          ? {
              contextLength: String(searchArgs.contextLength),
            }
          : {}),
      });

      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${queryParams}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Vault Files or Directories List
  tools.register(
    type({
      name: '"list_vault_files"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        "directory?": "string",
      },
    }).describe(
      "List files in the root directory or a specified subdirectory of the specified vault.",
    ),
    async ({ arguments: args }) => {
      const { vaultId, directory } = args; // Extract vaultId
      const path = directory ? `${directory}/` : "";
      const data = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiVaultFileResponse.or(
          LocalRestAPI.ApiVaultDirectoryResponse,
        ),
        `/vault/${path}`,
        vaultConfigProvider, // Pass vaultConfigProvider
      );
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Vault File Content
  tools.register(
    type({
      name: '"get_vault_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        filename: "string",
        "format?": '"markdown" | "json"',
      },
    }).describe("Get the content of a file from the specified vault."),
    async ({ arguments: args }) => {
      const { vaultId, filename, format: argFormat } = args; // Extract vaultId
      const isJson = argFormat === "json";
      const acceptHeader = isJson
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";
      const data = await makeRequest(
        vaultId, // Pass vaultId
        isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(filename)}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          headers: { Accept: acceptHeader },
        },
      );
      return {
        content: [
          {
            type: "text",
            text:
              typeof data === "string" ? data : JSON.stringify(data, null, 2),
          },
        ],
      };
    },
  );

  // PUT Vault File Content
  tools.register(
    type({
      name: '"create_vault_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        filename: "string",
        content: "string",
      },
    }).describe("Create a new file in the specified vault or update an existing one."),
    async ({ arguments: args }) => {
      const { vaultId, filename, content } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(filename)}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "PUT",
          body: content,
        },
      );
      return {
        content: [{ type: "text", text: "File created successfully" }],
      };
    },
  );

  // POST Vault File Content
  tools.register(
    type({
      name: '"append_to_vault_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        filename: "string",
        content: "string",
      },
    }).describe("Append content to a new or existing file in the specified vault."), // Updated description
    async ({ arguments: args }) => {
      const { vaultId, filename, content } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(filename)}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "POST",
          body: content,
        },
      );
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Vault File Content
  tools.register(
    type({
      name: '"patch_vault_file"',
      // Add vaultId to the existing arguments
      arguments: type({ vaultId: "string>0", filename: "string" }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file in the specified vault, relative to a heading, block reference, or frontmatter field.", // Updated description
    ),
    async ({ arguments: args }) => {
      const { vaultId, filename, ...patchArgs } = args; // Extract vaultId and filename, rest are patchArgs
      const headers: Record<string, string> = { // Changed HeadersInit to Record<string, string> for consistency
        Operation: patchArgs.operation,
        "Target-Type": patchArgs.targetType,
        Target: patchArgs.target,
        "Create-Target-If-Missing": "true",
      };

      if (patchArgs.targetDelimiter) {
        headers["Target-Delimiter"] = patchArgs.targetDelimiter;
      }
      if (patchArgs.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(patchArgs.trimTargetWhitespace);
      }
      if (patchArgs.contentType) {
        headers["Content-Type"] = patchArgs.contentType;
      }

      const response = await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(filename)}`, // Use filename
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "PATCH",
          headers,
          body: patchArgs.content,
        },
      );
      // Ensure 'response' is a string before returning. If it's an object, stringify it.
      const responseText = typeof response === 'string' ? response : JSON.stringify(response);
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: responseText },
        ],
      };
    },
  );

  // DELETE Vault File Content
  tools.register(
    type({
      name: '"delete_vault_file"',
      arguments: {
        vaultId: "string>0", // Added vaultId
        filename: "string",
      },
    }).describe("Delete a file from the specified vault."), // Updated description
    async ({ arguments: args }) => {
      const { vaultId, filename } = args; // Extract vaultId
      await makeRequest(
        vaultId, // Pass vaultId
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(filename)}`,
        vaultConfigProvider, // Pass vaultConfigProvider
        {
          method: "DELETE",
        },
      );
      return {
        content: [{ type: "text", text: "File deleted successfully" }],
      };
    },
  );
}
