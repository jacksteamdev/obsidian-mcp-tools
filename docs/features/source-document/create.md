# Source Document Creation Implementation

## Overview

The create stage implements the document creation workflow, from fetching web content to creating the final Markdown document in Obsidian.

## Implementation Location

```
packages/mcp-server/src/features/source-document/
├── services/
│   ├── markdown.ts        # HTML to Markdown conversion
│   └── document.ts        # Document creation logic
├── utils/
│   └── sanitize.ts        # Title sanitization
└── tests/
    └── markdown.test.ts   # Conversion tests
```

## Document Template Format

Templates use Templater syntax and have access to the following variables:

```markdown
---
title: <% tp.mcpTools.prompt("metadata.title") %>
author: <% tp.mcpTools.prompt("metadata.author") %>
date: <% tp.mcpTools.prompt("metadata.datePublished") %>
url: <% tp.mcpTools.prompt("metadata.canonicalUrl") %>
site: <% tp.mcpTools.prompt("metadata.siteName") %>
modified: <% tp.mcpTools.prompt("metadata.dateModified") %>
---

<% tp.mcpTools.prompt("content") %>
```

Available variables:
- `metadata.title` - Document title
- `metadata.author` - Author name (if available)
- `metadata.datePublished` - Publication date (if available)
- `metadata.dateModified` - Last modified date (if available)
- `metadata.canonicalUrl` - Original URL
- `metadata.siteName` - Source website name (if available)
- `content` - Converted Markdown content

## Document ID Generation

```typescript
// utils/sanitize.ts
export function sanitizeTitle(title: string): string {
  return title
    // Remove author and website info (typically after " - " or " | ")
    .split(/\s[|-]\s/)[0]
    // Replace invalid filename characters
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
    // Convert multiple dashes to single
    .replace(/-+/g, "-")
    // Remove leading/trailing dash and whitespace
    .trim()
    .replace(/^-|-$/g, "")
}

// Examples:
// "How to Build a CLI - John Doe | Example.com" -> "How to Build a CLI"
// "深入理解 JavaScript - 编程指南" -> "深入理解 JavaScript"
// "La programación es divertida!" -> "La programación es divertida!"
```

## ArkType Validation

```typescript
// types.ts
import { type } from "arktype";

export const createSourceSchema = type({
  "url": type("string").describe(
    "Valid URL to fetch content from"
  ),
});

export const documentMetadataSchema = type({
  "canonicalUrl": "string",
  "title": "string",
  "dateModified?": "string",
  "datePublished?": "string",
  "author?": "string",
  "siteName?": "string",
});

export type CreateSourceParams = typeof createSourceSchema.infer;
export type DocumentMetadata = typeof documentMetadataSchema.infer;
```

## HTML to Markdown Conversion

```typescript
// services/markdown.ts
import TurndownService from "turndown";

function resolveUrl(base: string, path: string): string {
  // Return path if it's already absolute
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // Handle absolute paths that start with /
  if (path.startsWith("/")) {
    const baseUrl = new URL(base);
    return `${baseUrl.protocol}//${baseUrl.host}${path}`;
  }

  // Resolve relative paths
  const resolved = new URL(path, base);
  return resolved.toString();
}

export function convertHtmlToMarkdown(html: string, baseUrl: string): string {
  const turndownService = new TurndownService({
    headingStyle: "atx",
    hr: "---",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
  });

  const rewriter = new HTMLRewriter()
    .on("script,style,meta,template,link", {
      element(element) {
        element.remove();
      },
    })
    .on("a", {
      element(element) {
        const href = element.getAttribute("href");
        if (href) {
          element.setAttribute("href", resolveUrl(baseUrl, href));
        }
      },
    })
    .on("img", {
      element(element) {
        const src = element.getAttribute("src");
        if (src?.startsWith("data:")) {
          element.remove();
        } else if (src) {
          element.setAttribute("src", resolveUrl(baseUrl, src));
        }
      },
    });

  let finalHtml = html;
  if (html.includes("<article")) {
    const articleStart = html.indexOf("<article");
    const articleEnd = html.lastIndexOf("</article>") + 10;
    finalHtml = html.substring(articleStart, articleEnd);
  }

  return turndownService
    .turndown(rewriter.transform(finalHtml))
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\[\n+/g, "[")
    .replace(/\n+\]/g, "]");
}
```

## MCP Tool Implementation

```typescript
// index.ts
import { type } from "arktype";
import { createSourceSchema } from "./types";
import { convertHtmlToMarkdown } from "./services/markdown";
import { sanitizeTitle } from "./utils/sanitize";

tools.register(
  createSourceSchema,
  async ({ arguments: args }) => {
    // 1. Fetch content
    const response = await fetch(args.url, {
      headers: { "User-Agent": DEFAULT_USER_AGENT },
    });

    if (!response.ok) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to fetch ${args.url}`
      );
    }

    const html = await response.text();

    // 2. Extract metadata
    const metadata = extractMetadata(html);
    const documentId = sanitizeTitle(metadata.title);

    // 3. Convert to markdown
    const markdown = convertHtmlToMarkdown(html, args.url);

    // 4. Create document via plugin
    const result = await makeRequest(
      LocalRestAPI.ApiTemplateExecutionResponse,
      `/sources/${documentId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: markdown,
          metadata,
        }),
      },
    );

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
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
  .post(async (req, res) => {
    const { documentId } = req.params;
    const { body, metadata } = req.body;

    try {
      // 1. Validate metadata
      const metadataResult = documentMetadataSchema(metadata);
      if (metadataResult instanceof type.errors) {
        return res.status(400).json({
          error: "Invalid metadata",
          details: metadataResult.summary,
        });
      }

      // 2. Get templater
      const { api: templater } = await lastValueFrom(loadTemplaterAPI(this));
      if (!templater) {
        return res.status(503).json({
          error: "Templater plugin is not available",
        });
      }

      const templateFile = this.app.vault.getAbstractFileByPath(
        this.settings.templatePath
      );
      if (!(templateFile instanceof TFile)) {
        return res.status(404).json({
          error: `Template not found: ${this.settings.templatePath}`,
        });
      }

      // 3. Process template
      const config = templater.create_running_config(
        templateFile,
        templateFile,
        Templater.RunMode.CreateNewFromTemplate
      );

      const processedContent = await templater.read_and_parse_template(
        config,
        { content: body, metadata }
      );

      // 4. Create document
      const targetPath = 
        `${this.settings.sourcesDirectory}/${documentId}.md`;
      const file = await this.app.vault.create(
        targetPath,
        processedContent
      );

      return res.json({
        documentId,
        metadata,
        path: file.path,
      });
    } catch (error) {
      logger.error("Document creation error:", {
        error: error instanceof Error ? error.message : error,
        documentId,
      });
      return res.status(503).json({
        error: "Failed to create document",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });
```

## Error Handling

1. URL Validation:
   - Validate URL format
   - Check for supported protocols
   - Handle network errors
   - Show clear error messages

2. Content Processing:
   - Handle invalid HTML
   - Handle missing metadata
   - Handle template errors
   - Clean up on failures

3. File System:
   - Handle existing files
   - Handle permission issues
   - Handle disk space issues
   - Show clear error messages

## Implementation Steps

1. Add Dependencies to MCP Server:
   ```json
   {
     "dependencies": {
       "turndown": "^7.1.2"
     }
   }
   ```

2. Create Utils:
   - Add sanitization functions
   - Add validation schemas
   - Add error handlers

3. Add Services:
   - Implement markdown conversion
   - Add metadata extraction
   - Add template processing

4. Add REST API:
   - Add endpoint handler
   - Add validation
   - Add error handling

5. Add MCP Tool:
   - Register tool
   - Add validation
   - Add error handling

6. Add Tests:
   - Test markdown conversion
   - Test title sanitization
   - Test template processing
