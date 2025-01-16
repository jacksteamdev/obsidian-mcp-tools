# Source Document Search Implementation

## Overview

The search stage implements document discovery through semantic search using Smart Connections, with fallback to Obsidian's fuzzy search.

## Implementation Location

```
packages/mcp-server/src/features/source-document/
├── services/
│   └── search.ts         # Search implementation
└── utils/
    └── match.ts         # Text matching utilities
```

## ArkType Validation

```typescript
// types.ts
import { type } from "arktype";

export const searchSourceSchema = type({
  "query": type("string>0").describe(
    "Search query text"
  ),
}).describe("Search for source documents");

export const searchResultSchema = type({
  "documentId": "string",
  "metadata": "DocumentMetadata",
  "matchingBlock": "string",
});

export type SearchSourceParams = typeof searchSourceSchema.infer;
export type SearchResult = typeof searchResultSchema.infer;
```

## MCP Tool Implementation

```typescript
// index.ts
import { type } from "arktype";
import { searchSourceSchema } from "./types";

tools.register(
  searchSourceSchema,
  async ({ arguments: args }) => {
    // Request search from plugin
    const result = await makeRequest(
      LocalRestAPI.ApiSearchResponse,
      "/sources/search",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: args.query }),
      },
    );

    // Validate results
    const results = type([searchResultSchema])(result);
    if (results instanceof type.errors) {
      throw new McpError(
        ErrorCode.InternalError,
        `Invalid search results: ${results.summary}`
      );
    }

    return {
      content: results.map(result => ({
        type: "text",
        text: JSON.stringify(result, null, 2),
      })),
    };
  }
);
```

## REST API Implementation

```typescript
// Plugin endpoint
this.localRestApi
  .addRoute("/sources/search")
  .post(async (req, res) => {
    const { query } = req.body;

    try {
      // 1. Validate query
      if (!query?.trim()) {
        return res.status(400).json({
          error: "Query is required",
        });
      }

      // 2. Try Smart Connections
      const { api: smartSearch } = await lastValueFrom(
        loadSmartSearchAPI(this)
      );

      if (smartSearch) {
        const results = await smartSearch.search(query, {
          key_starts_with_any: [this.settings.sourcesDirectory],
        });

        return res.json(
          await Promise.all(
            results.map(async (result) => ({
              documentId: getDocumentId(
                result.item.path,
                this.settings.sourcesDirectory
              ),
              metadata: await getMetadata(this.app, result.item.path),
              matchingBlock: await result.item.read(),
            }))
          )
        );
      }

      // 3. Fallback to fuzzy search
      logger.info(
        "Smart Connections not available, using fuzzy search"
      );
      const results = await basicSearch(
        this.app,
        query,
        this.settings.sourcesDirectory
      );
      return res.json(results);
    } catch (error) {
      logger.error("Search error:", {
        error: error instanceof Error ? error.message : error,
        query,
      });
      return res.status(503).json({
        error: "Search failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
```

## Search Implementation

```typescript
// services/search.ts
import { prepareFuzzySearch } from "obsidian";

export async function basicSearch(
  app: App,
  query: string,
  sourcesDirectory: string
): Promise<SearchResult[]> {
  const files = app.vault.getFiles()
    .filter(file => 
      file.path.startsWith(sourcesDirectory)
    );

  const fuzzySearch = prepareFuzzySearch(query);
  const results: SearchResult[] = [];

  for (const file of files) {
    const content = await app.vault.read(file);
    const match = findMatchingBlock(content, fuzzySearch);
    
    if (match) {
      results.push({
        documentId: getDocumentId(file.path, sourcesDirectory),
        metadata: await getMetadata(app, file.path),
        matchingBlock: match,
      });
    }
  }

  return results;
}

export function getDocumentId(
  path: string,
  sourcesDirectory: string
): string {
  return path
    .replace(`${sourcesDirectory}/`, "")
    .replace(".md", "");
}

export async function getMetadata(
  app: App,
  path: string
): Promise<DocumentMetadata> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    return {};
  }

  const cache = app.metadataCache.getFileCache(file);
  return cache?.frontmatter || {};
}
```

## Text Matching

```typescript
// utils/match.ts
import { FuzzyMatch } from "obsidian";

export function findMatchingBlock(
  content: string,
  fuzzySearch: (text: string) => FuzzyMatch | null
): string | null {
  const blocks = content.split(/\n\s*\n/);

  for (const block of blocks) {
    if (fuzzySearch(block)) {
      return block.trim();
    }
  }

  return null;
}
```

## Error Handling

1. Search Execution:
   - Handle invalid queries
   - Handle plugin availability
   - Handle search timeouts
   - Show clear error messages

2. Result Processing:
   - Handle missing metadata
   - Handle malformed content
   - Handle large result sets
   - Show clear error messages

3. Plugin Integration:
   - Handle Smart Connections errors
   - Handle graceful fallback
   - Handle API changes
   - Show clear error messages

## Implementation Steps

1. Add Types:
   - Define schemas
   - Add validation
   - Export types

2. Add Services:
   - Implement search functions
   - Add Smart Connections integration
   - Add fuzzy search fallback

3. Add REST API:
   - Add endpoint handler
   - Add validation
   - Add error handling

4. Add MCP Tool:
   - Register tool
   - Add validation
   - Add error handling

5. Add Tests:
   - Test fuzzy search
   - Test block matching
   - Test metadata extraction
