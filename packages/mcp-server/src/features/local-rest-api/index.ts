import { makeRequest, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

export function registerLocalRestApiTools(tools: ToolRegistry, server: Server) {
  // GET Status
  tools.register(
    type({
      name: '"get_server_info"',
      arguments: "Record<string, unknown>",
    }).describe(
      "Returns basic details about the Obsidian Local REST API and authentication status. This is the only API request that does not require authentication.",
    ),
    async () => {
      const data = await makeRequest(LocalRestAPI.ApiStatusResponse, "/");
      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  // GET Active File
  tools.register(
    type({
      name: '"get_active_file"',
      arguments: {
        "format?": type('"markdown" | "json"').describe(
          "Response format: 'markdown' for raw content or 'json' for parsed with frontmatter and tags. Optional, defaults to 'markdown'.",
        ),
      },
    }).describe(
      "Returns the content of the currently active file in Obsidian. Can return either markdown content or a JSON representation including parsed tags and frontmatter. " +
        "Example: { format: 'json' }",
    ),
    async ({ arguments: args }) => {
      const format =
        args?.format === "json"
          ? "application/vnd.olrapi.note+json"
          : "text/markdown";
      const data = await makeRequest(
        LocalRestAPI.ApiNoteJson.or("string"),
        "/active/",
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
        content: type("string").describe(
          "The complete new content to write to the file. REQUIRED.",
        ),
      },
    }).describe(
      "Update the content of the active file open in Obsidian. " +
        "IMPORTANT: The 'content' argument is required. " +
        "Example: { content: '# My Note\\n\\nUpdated content here' }",
    ),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "PUT",
        body: args.content,
      });
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
        content: type("string").describe(
          "The content to append to the end of the file. REQUIRED.",
        ),
      },
    }).describe(
      "Append content to the end of the currently-open note. " +
        "IMPORTANT: The 'content' argument is required. " +
        "Example: { content: '\\n\\n## New Section\\n\\nAppended content' }",
    ),
    async ({ arguments: args }) => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "POST",
        body: args.content,
      });
      return {
        content: [{ type: "text", text: "Content appended successfully" }],
      };
    },
  );

  // PATCH Active File
  tools.register(
    type({
      name: '"patch_active_file"',
      arguments: LocalRestAPI.ApiPatchParameters,
    }).describe(
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field. " +
        "IMPORTANT: The 'operation', 'targetType', 'target', and 'content' arguments are required. " +
        "Example: { operation: 'append', targetType: 'heading', target: 'My Heading', content: '\\n\\nNew content' }",
    ),
    async ({ arguments: args }) => {
      const headers: Record<string, string> = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        "/active/",
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );
      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Active File
  tools.register(
    type({
      name: '"delete_active_file"',
      arguments: "Record<string, unknown>",
    }).describe("Delete the currently-active file in Obsidian."),
    async () => {
      await makeRequest(LocalRestAPI.ApiNoContentResponse, "/active/", {
        method: "DELETE",
      });
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
        filename: type("string").describe(
          "The vault-relative path to the file (e.g., 'notes/my-note.md'). REQUIRED.",
        ),
        "newLeaf?": type("boolean").describe(
          "Whether to open in a new tab. Optional, defaults to false.",
        ),
      },
    }).describe(
      "Open a document in the Obsidian UI. Creates a new document if it doesn't exist. " +
        "IMPORTANT: The 'filename' argument is required. " +
        "Example: { filename: 'daily/2025-01-17.md' }",
    ),
    async ({ arguments: args }) => {
      const query = args.newLeaf ? "?newLeaf=true" : "";

      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/open/${encodeURIComponent(args.filename)}${query}`,
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
        queryType: type('"dataview" | "jsonlogic"').describe(
          "The query language to use: 'dataview' for DQL or 'jsonlogic'. REQUIRED.",
        ),
        query: type("string").describe(
          "The search query string in the specified query language. REQUIRED.",
        ),
      },
    }).describe(
      "Search for documents matching a specified query using either Dataview DQL or JsonLogic. " +
        "IMPORTANT: Both 'queryType' and 'query' arguments are required. " +
        "Example: { queryType: 'dataview', query: 'LIST FROM \"notes\"' }",
    ),
    async ({ arguments: args }) => {
      const contentType =
        args.queryType === "dataview"
          ? "application/vnd.olrapi.dataview.dql+txt"
          : "application/vnd.olrapi.jsonlogic+json";

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: { "Content-Type": contentType },
          body: args.query,
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
        query: type("string").describe(
          "The text search query to find in vault files. REQUIRED.",
        ),
        "contextLength?": type("number").describe(
          "Number of characters of context around matches. Optional.",
        ),
      },
    }).describe(
      "Search for documents matching a text query. " +
        "IMPORTANT: The 'query' argument is required. " +
        "Example: { query: 'meeting notes' }",
    ),
    async ({ arguments: args }) => {
      const query = new URLSearchParams({
        query: args.query,
        ...(args.contextLength
          ? {
              contextLength: String(args.contextLength),
            }
          : {}),
      });

      const data = await makeRequest(
        LocalRestAPI.ApiSimpleSearchResponse,
        `/search/simple/?${query}`,
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
        "directory?": type("string").describe(
          "The vault-relative path to list. Optional, defaults to vault root.",
        ),
      },
    }).describe(
      "List files in the root directory or a specified subdirectory of your vault. " +
        "Example: { directory: 'notes/projects' }",
    ),
    async ({ arguments: args }) => {
      const path = args.directory ? `${args.directory}/` : "";
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse.or(
          LocalRestAPI.ApiVaultDirectoryResponse,
        ),
        `/vault/${path}`,
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
        filename: type("string").describe(
          "The vault-relative path to the file (e.g., 'notes/my-note.md'). REQUIRED.",
        ),
        "format?": type('"markdown" | "json"').describe(
          "Response format: 'markdown' for raw content or 'json' for parsed with frontmatter. Optional, defaults to 'markdown'.",
        ),
      },
    }).describe(
      "Get the content of a file from your vault. " +
        "IMPORTANT: The 'filename' argument is required. " +
        "Example: { filename: 'daily/2025-01-17.md' }",
    ),
    async ({ arguments: args }) => {
      const isJson = args.format === "json";
      const format = isJson
        ? "application/vnd.olrapi.note+json"
        : "text/markdown";
      const data = await makeRequest(
        isJson ? LocalRestAPI.ApiNoteJson : LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          headers: { Accept: format },
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
        filename: type("string").describe(
          "The vault-relative path to the file (e.g., 'notes/my-note.md'). REQUIRED.",
        ),
        content: type("string").describe(
          "The complete content to write to the file. REQUIRED.",
        ),
      },
    }).describe(
      "Create a new file in your vault or update an existing file. " +
        "IMPORTANT: Both 'filename' and 'content' arguments are required. " +
        "Example: { filename: 'daily/2025-01-17.md', content: '# Daily Note\\n\\nContent here' }",
    ),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "PUT",
          body: args.content,
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
        filename: type("string").describe(
          "The vault-relative path to the file (e.g., 'notes/my-note.md'). REQUIRED.",
        ),
        content: type("string").describe(
          "The content to append to the end of the file. REQUIRED.",
        ),
      },
    }).describe(
      "Append content to a new or existing file. " +
        "IMPORTANT: Both 'filename' and 'content' arguments are required. " +
        "Example: { filename: 'journal/log.md', content: '\\n\\n## New Entry\\n\\nContent here' }",
    ),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "POST",
          body: args.content,
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
      arguments: type({
        filename: type("string").describe(
          "The vault-relative path to the file (e.g., 'notes/my-note.md'). REQUIRED.",
        ),
      }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field. " +
        "IMPORTANT: The 'filename', 'operation', 'targetType', 'target', and 'content' arguments are required. " +
        "Example: { filename: 'notes/todo.md', operation: 'append', targetType: 'heading', target: 'Tasks', content: '\\n- [ ] New task' }",
    ),
    async ({ arguments: args }) => {
      const headers: HeadersInit = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: args.target,
        "Create-Target-If-Missing": "true",
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = args.targetDelimiter;
      }
      if (args.trimTargetWhitespace !== undefined) {
        headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
      }
      if (args.contentType) {
        headers["Content-Type"] = args.contentType;
      }

      const response = await makeRequest(
        LocalRestAPI.ApiContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
        {
          method: "PATCH",
          headers,
          body: args.content,
        },
      );

      return {
        content: [
          { type: "text", text: "File patched successfully" },
          { type: "text", text: response },
        ],
      };
    },
  );

  // DELETE Vault File Content
  tools.register(
    type({
      name: '"delete_vault_file"',
      arguments: {
        filename: type("string").describe(
          "The vault-relative path to the file to delete (e.g., 'notes/old-note.md'). REQUIRED.",
        ),
      },
    }).describe(
      "Delete a file from your vault. " +
        "IMPORTANT: The 'filename' argument is required. " +
        "Example: { filename: 'archive/old-note.md' }",
    ),
    async ({ arguments: args }) => {
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/vault/${encodeURIComponent(args.filename)}`,
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
