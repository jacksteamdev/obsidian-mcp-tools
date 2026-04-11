import { makeRequest, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

/**
 * Parse markdown content and resolve a partial heading name to its full
 * hierarchical path as expected by the Local REST API `markdown-patch`
 * indexer (e.g. `"Section A"` → `"Top Level::Section A"`).
 *
 * Returns the full path of the first matching heading, or `null` if no
 * heading with that exact name exists in the content.
 *
 * Exported so it can be unit-tested without network access.
 */
export function resolveHeadingPath(
  content: string,
  leafName: string,
  delimiter: string,
): string | null {
  const lines = content.split("\n");
  // Stack of heading names at each indentation level. stack[level-1] holds
  // the name of the heading at that level. When we encounter a heading at
  // level N, all deeper levels become stale and are truncated.
  const stack: string[] = [];

  for (const line of lines) {
    const match = line.match(/^(#{1,6})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const headingText = match[2].trim();

    // Drop any stack entries deeper than the current level, then set the
    // current level's slot. This keeps `stack.slice(0, level)` a valid
    // ancestor path for any subsequent match at a deeper level.
    stack.length = level - 1;
    stack[level - 1] = headingText;

    if (headingText === leafName) {
      // Join the full ancestor chain (including the match itself) with the
      // delimiter the caller will also pass as the Target-Delimiter header.
      return stack.slice(0, level).join(delimiter);
    }
  }

  return null;
}

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
        format: type('"markdown" | "json"').optional(),
      },
    }).describe(
      "Returns the content of the currently active file in Obsidian. Can return either markdown content or a JSON representation including parsed tags and frontmatter.",
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
        content: "string",
      },
    }).describe("Update the content of the active file open in Obsidian."),
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
        content: "string",
      },
    }).describe("Append content to the end of the currently-open note."),
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
      "Insert or modify content in the currently-open note relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      // Step 1: resolve partial heading names to full hierarchical paths.
      // Local REST API's markdown-patch indexer keys headings by their full
      // ancestor path (e.g. "Top Level::Section A"). When the caller supplies
      // just a leaf name ("Section A"), the lookup fails and — because
      // Create-Target-If-Missing is on by default — a new heading is silently
      // appended at EOF instead of patching the intended one. To prevent this,
      // fetch the file once, parse its heading tree, and expand the partial
      // name to a full path before issuing the PATCH.
      const targetDelimiter = args.targetDelimiter ?? "::";
      let resolvedTarget = args.target;

      if (
        args.targetType === "heading" &&
        !args.target.includes(targetDelimiter)
      ) {
        const fileContent = await makeRequest(
          LocalRestAPI.ApiContentResponse,
          "/active/",
          { headers: { Accept: "text/markdown" } },
        );
        const fullPath = resolveHeadingPath(
          fileContent,
          args.target,
          targetDelimiter,
        );
        if (fullPath) {
          resolvedTarget = fullPath;
        }
      }

      // Step 2: ensure appended content has trailing whitespace so the
      // next section in the document remains visually separated.
      let body = args.content;
      if (args.operation === "append" && !body.endsWith("\n")) {
        body = body + "\n\n";
      }

      // Step 3: build headers. Target and Target-Delimiter are URL-encoded
      // so non-ASCII headings (Japanese, emoji, special chars) and newlines
      // survive the HTTP header layer intact. Encoding happens *after* path
      // resolution — otherwise the indexer lookup would match an encoded
      // string against unencoded file content.
      const headers: Record<string, string> = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: encodeURIComponent(resolvedTarget),
        "Create-Target-If-Missing": String(args.createTargetIfMissing ?? true),
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = encodeURIComponent(args.targetDelimiter);
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
          body,
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
        filename: "string",
        "newLeaf?": "boolean",
      },
    }).describe(
      "Open a document in the Obsidian UI. Creates a new document if it doesn't exist. Returns a confirmation if the file was opened successfully.",
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
        queryType: '"dataview" | "jsonlogic"',
        query: "string",
      },
    }).describe(
      "Search for documents matching a specified query using either Dataview DQL or JsonLogic.",
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
        query: "string",
        "contextLength?": "number",
      },
    }).describe("Search for documents matching a text query."),
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
        "directory?": "string",
      },
    }).describe(
      "List files in the root directory or a specified subdirectory of your vault.",
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
        filename: "string",
        "format?": '"markdown" | "json"',
      },
    }).describe("Get the content of a file from your vault."),
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
        filename: "string",
        content: "string",
      },
    }).describe("Create a new file in your vault or update an existing one."),
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
        filename: "string",
        content: "string",
      },
    }).describe("Append content to a new or existing file."),
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
        filename: "string",
      }).and(LocalRestAPI.ApiPatchParameters),
    }).describe(
      "Insert or modify content in a file relative to a heading, block reference, or frontmatter field.",
    ),
    async ({ arguments: args }) => {
      // See patch_active_file above for the full rationale of these three
      // steps. The only difference here is the endpoint from which we
      // fetch file content for heading resolution — the named vault file
      // instead of the currently active file.
      const targetDelimiter = args.targetDelimiter ?? "::";
      let resolvedTarget = args.target;

      if (
        args.targetType === "heading" &&
        !args.target.includes(targetDelimiter)
      ) {
        const fileContent = await makeRequest(
          LocalRestAPI.ApiContentResponse,
          `/vault/${encodeURIComponent(args.filename)}`,
          { headers: { Accept: "text/markdown" } },
        );
        const fullPath = resolveHeadingPath(
          fileContent,
          args.target,
          targetDelimiter,
        );
        if (fullPath) {
          resolvedTarget = fullPath;
        }
      }

      let body = args.content;
      if (args.operation === "append" && !body.endsWith("\n")) {
        body = body + "\n\n";
      }

      const headers: HeadersInit = {
        Operation: args.operation,
        "Target-Type": args.targetType,
        Target: encodeURIComponent(resolvedTarget),
        "Create-Target-If-Missing": String(args.createTargetIfMissing ?? true),
      };

      if (args.targetDelimiter) {
        headers["Target-Delimiter"] = encodeURIComponent(args.targetDelimiter);
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
          body,
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
        filename: "string",
      },
    }).describe("Delete a file from your vault."),
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
