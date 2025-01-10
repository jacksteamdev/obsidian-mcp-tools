# Source Document Reading Implementation

## Overview

The read stage implements paginated access to source documents, enabling thoughtful processing of content.

## Implementation Location

```
packages/mcp-server/src/features/source-document/
├── services/
│   └── pagination.ts      # Page extraction logic
└── utils/
    └── blocks.ts         # Content block handling
```

## ArkType Validation

```typescript
// types.ts
import { type } from "arktype";

export const readSourceSchema = type({
  "documentId": "string",
  "page": type("number>0?").describe(
    "Page number (defaults to 1)"
  ),
});

export const pageResponseSchema = type({
  "content": "string",
  "pageNumber": "number>0",
  "totalPages": "number>0",
});

export type ReadSourceParams = typeof readSourceSchema.infer;
export type PageResponse = typeof pageResponseSchema.infer;
```

## MCP Tool Implementation

```typescript
// index.ts
import { type } from "arktype";
import { readSourceSchema } from "./types";

tools.register(
  readSourceSchema,
  async ({ arguments: args }) => {
    const page = args.page || 1;
    
    // Request page from plugin
    const result = await makeRequest(
      LocalRestAPI.ApiPageResponse,
      `/sources/${args.documentId}`,
      {
        method: "GET",
        params: { page },
      },
    );

    // Validate response
    const response = pageResponseSchema(result);
    if (response instanceof type.errors) {
      throw new McpError(
        ErrorCode.InternalError,
        `Invalid page response: ${response.summary}`
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
      ],
    };
  }
);
```

## REST API Implementation

```typescript
// Plugin endpoint
this.localRestApi
  .addRoute("/sources/:documentId")
  .get(async (req, res) => {
    const { documentId } = req.params;
    const page = Number(req.query.page) || 1;

    try {
      // 1. Get document
      const file = this.app.vault.getAbstractFileByPath(
        `${this.settings.sourcesDirectory}/${documentId}.md`
      );

      if (!file || !(file instanceof TFile)) {
        return res.status(404).json({
          error: "Document not found",
        });
      }

      // 2. Read content
      const content = await this.app.vault.read(file);

      // 3. Extract page
      const { pageContent, pageNumber, totalPages } = 
        await this.extractPage(content, page);

      return res.json({
        content: pageContent,
        pageNumber,
        totalPages,
      });
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
// services/pagination.ts
interface PageExtraction {
  pageContent: string;
  pageNumber: number;
  totalPages: number;
}

export async function extractPage(
  content: string,
  pageNumber: number,
  maxPageSize: number
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
      `Invalid page number: ${pageNumber}. Total pages: ${totalPages}`
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
// utils/blocks.ts
export function splitIntoBlocks(content: string): string[] {
  return content
    // Split on double newline
    .split(/\n\s*\n/)
    // Remove empty blocks
    .filter(block => block.trim().length > 0)
    // Normalize whitespace
    .map(block => block.trim());
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

## Implementation Steps

1. Add Types:
   - Define schemas
   - Add validation
   - Export types

2. Add Services:
   - Implement pagination
   - Add block handling
   - Add error handling

3. Add REST API:
   - Add endpoint handler
   - Add validation
   - Add error handling

4. Add MCP Tool:
   - Register tool
   - Add validation
   - Add error handling

5. Add Tests:
   - Test block splitting
   - Test page extraction
   - Test edge cases
