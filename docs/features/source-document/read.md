# Source Document Reading Implementation

## Overview

The read stage implements paginated access to source documents, enabling thoughtful processing of content. Pagination takes place in the Obsidian plugin which manages the Source Document feature settings.

## Implementation Location

```
packages/obsidian-plugin/src/features/source-documents/
├── services/
│   └── pagination.ts      # Page extraction logic
└── utils/
    └── blocks.ts         # Content block handling

packages/shared/src/types/
└── source-document.ts    # Shared schemas and types
```

## ArkType Validation

```typescript
// packages/shared/src/types/source-document.ts
import { type } from "arktype";

export const readParams = type({
  documentId: "string",
  "page?": type("number>0").describe("Page number (defaults to 1)"),
  "related?": type("boolean").describe(
    "Search for semantically related vault content",
  ),
});

export const readResponse = type({
  content: "string",
  pageNumber: "number>0",
  totalPages: "number>0",
  "related?": searchResult.array(),
});

export type ReadParams = typeof readParams.infer;
export type ReadResponse = typeof readResponse.infer;
```

## MCP Tool Implementation

```typescript
// packages/mcp-server/src/features/source-document/index.ts
import { type } from "arktype";
import { SourceDocuments } from "shared";

tools.register(
  type({
    name: "'read_source'",
    arguments: SourceDocuments.readParams,
  }).describe("Read a source document incrementally"),
  async ({ arguments: args }) => {
    const page = args.page || 1;

    // Proxy request to plugin REST API
    const result = await makeRequest(
      LocalRestAPI.ApiPageResponse,
      `/sources/${args.documentId}`,
      {
        method: "GET",
        params: { page },
      },
    );

    // Validate response
    const response = SourceDocuments.readResponse(result);
    if (response instanceof type.errors) {
      throw new McpError(
        ErrorCode.InternalError,
        `Invalid page response: ${response.summary}`,
      );
    }

    return {
      content: [
        {
          type: "text",
          text: response.content,
        },
        {
          type: "text",
          text: `Page ${response.pageNumber} of ${response.totalPages}`,
        },
        ...(response.related
          ? [
              {
                type: "text",
                text: "Related Content:",
              },
              ...response.related.map((result) => ({
                type: "text",
                text: `${result.documentId}: ${result.matchingBlock}`,
              })),
            ]
          : []),
      ],
    };
  },
);
```

## REST API Implementation

```typescript
// packages/obsidian-plugin/src/features/source-documents/index.ts
import { SourceDocuments } from "shared";
import { extractPage } from "./services/pagination";

// Plugin endpoint
this.localRestApi.addRoute("/sources/:documentId").get(async (req, res) => {
  const { documentId } = req.params;
  const page = Number(req.query.page) || 1;
  const related = req.query.related === "true";

  try {
    // 1. Get document
    const file = this.app.vault.getAbstractFileByPath(
      `${this.settings.sourcesDirectory}/${documentId}.md`,
    );

    if (!file || !(file instanceof TFile)) {
      return res.status(404).json({
        error: "Document not found",
      });
    }

    // 2. Read content
    const content = await this.app.vault.read(file);

    // 3. Extract page using plugin's pagination service
    const { pageContent, pageNumber, totalPages } = await extractPage(
      content,
      page,
      this.settings.maxPageSize,
    );

    // 4. Find related content if requested
    let relatedContent;
    if (related) {
      const { api: smartSearch } = await lastValueFrom(
        loadSmartSearchAPI(this),
      );
      if (smartSearch) {
        relatedContent = await smartSearch.search(pageContent, {
          key_starts_with_any: [this.settings.sourcesDirectory],
          exclude: [file.path],
        });
      }
    }

    // 5. Validate response
    const response = SourceDocuments.readResponse({
      content: pageContent,
      pageNumber,
      totalPages,
      ...(relatedContent && { related: relatedContent }),
    });
    if (response instanceof type.errors) {
      throw new Error(`Invalid page response: ${response.summary}`);
    }

    return res.json(response);
  } catch (error) {
    logger.error("Document read error:", {
      error: error instanceof Error ? error.message : error,
      documentId,
      page,
    });
    return res.status(503).json({
      error: "Failed to read document",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
```

## Pagination Service

```typescript
// packages/obsidian-plugin/src/features/source-documents/services/pagination.ts
interface PageExtraction {
  pageContent: string;
  pageNumber: number;
  totalPages: number;
}

export async function extractPage(
  content: string,
  pageNumber: number,
  maxPageSize: number,
): Promise<PageExtraction> {
  // 1. Split into blocks
  const blocks = splitIntoBlocks(content);

  // 2. Calculate pages
  const pages = [];
  let currentPage = [];
  let currentSize = 0;

  for (const block of blocks) {
    if (currentSize + block.length > maxPageSize) {
      pages.push(currentPage.join("\n\n"));
      currentPage = [block];
      currentSize = block.length;
    } else {
      currentPage.push(block);
      currentSize += block.length;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n\n"));
  }

  // 3. Validate page number
  const totalPages = pages.length;
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(
      `Invalid page number: ${pageNumber}. Total pages: ${totalPages}`,
    );
  }

  return {
    pageContent: pages[pageNumber - 1],
    pageNumber,
    totalPages,
  };
}
```

## Block Handling

```typescript
// packages/obsidian-plugin/src/features/source-documents/utils/blocks.ts
export function splitIntoBlocks(content: string): string[] {
  return (
    content
      // Split on double newline
      .split(/\n\s*\n/)
      // Remove empty blocks
      .filter((block) => block.trim().length > 0)
      // Normalize whitespace
      .map((block) => block.trim())
  );
}
```

## Error Handling

1. Document Access:

   - Handle missing documents
   - Handle permission issues
   - Handle file system errors
   - Show clear error messages

2. Page Extraction:

   - Handle invalid page numbers
   - Handle empty documents
   - Handle oversized blocks
   - Show clear error messages

3. Content Processing:

   - Handle malformed content
   - Handle edge cases
   - Handle memory limits
   - Show clear error messages

4. Related Content:
   - Handle Smart Connections availability
   - Handle search errors
   - Handle large result sets
   - Show clear error messages

## Implementation Steps

1. Add Types to Shared Package:

   - Move schemas to shared
   - Add validation
   - Export types

2. Update Plugin:

   - Add pagination service
   - Add block handling
   - Add REST API endpoint
   - Add error handling
   - Add related content support

3. Update MCP Server:

   - Update tool to proxy requests
   - Add validation
   - Add error handling
   - Add related content handling

4. Add Tests:
   - Test block splitting
   - Test page extraction
   - Test edge cases
   - Test related content
