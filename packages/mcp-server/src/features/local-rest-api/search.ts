import { f, logger, makeRequest, type ToolRegistry } from "$/shared";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";

export default function setup(tools: ToolRegistry, server: Server) {
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

  // POST Search via Dataview
  tools.register(
    type({
      name: '"search_dql"',
      arguments: {
        query: "string",
      },
    }).describe(f`Search vault documents using Dataview TABLE queries.
                  - Find docs with multiple tags:
                      TABLE file.path
                      FROM #tag-a AND #tag-b
                  - Find docs with any of multiple tags:
                      TABLE file.path
                      FROM #tag-a OR #tag-b
                  - Search in specific folders:
                      TABLE file.path
                      FROM "Sources" AND #tag-a AND #tag-b
                  - Exclude specific folders:
                      TABLE file.path 
                      FROM #tag-a AND #tag-b
                      WHERE !contains(file.path, "Sources/")
                  - With metadata:
                      TABLE
                        file.path as "Path",
                        status as "Status",
                        rating as "Rating"
                      FROM #book
                      SORT rating DESC
                  Results include requested fields in tabular format.`),
    async ({ arguments: args }) => {
      const contentType = "application/vnd.olrapi.dataview.dql+txt";

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

  // Tag Search Tools
  tools.register(
    type({
      name: '"search_tags"',
      arguments: {
        include: type("string[]").describe(
          "List of tags to include, all of which must be present",
        ),
        "exclude?": type("string[]").describe("List of tags to exclude"),
        "folder?": "string",
      },
    }).describe(
      "Search for documents with specific tag combinations. Returns array of matching files with their full tag lists.",
    ),
    async ({ arguments: args }) => {
      const folderPrefix = args.folder ? `"${args.folder}" AND ` : "";
      const includeTags = args.include.map((t) => `#${t}`).join(" AND ");
      const excludeClause = args.exclude
        ? `!(${args.exclude.map((t) => `contains(file.tags,"${t}")`).join(" OR ")})`
        : "true";

      const query = f`TABLE file.path, tags
                      FROM ${folderPrefix}${includeTags}
                      WHERE ${excludeClause}
                      SORT file.path ASC`;
      logger.debug(`search_tags`, { args, query });

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/vnd.olrapi.dataview.dql+txt",
          },
          body: query,
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      };
    },
  );

  tools.register(
    type({
      name: '"list_file_tags"',
      arguments: {
        "folder?": "string",
      },
    }).describe(
      "List all unique tags used in files. Returns sorted array of tag names.",
    ),
    async ({ arguments: args }) => {
      const folderPrefix = args.folder ? `"${args.folder}"` : `""`;
      const query = f`TABLE tags
                      FROM ${folderPrefix}
                      WHERE tags`;
      logger.debug(`list_file_tags`, { args, query });

      const data = await makeRequest(
        LocalRestAPI.ApiSearchResponse,
        "/search/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/vnd.olrapi.dataview.dql+txt",
          },
          body: query,
        },
      );

      // Extract unique tags from results and sort them
      const uniqueTags = new Set<string>();
      for (const row of data) {
        if (Array.isArray(row.result.tags)) {
          row.result.tags.forEach((tag: string) => uniqueTags.add(tag));
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify([...uniqueTags].sort(), null, 2),
          },
        ],
      };
    },
  );
}
