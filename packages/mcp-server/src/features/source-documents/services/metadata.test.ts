import { describe, test as it, expect } from "bun:test";
import { extractMetadata } from "./metadata";

describe("extractMetadata", () => {
  it("should extract basic metadata", () => {
    const html = `
      <html>
        <head>
          <title>Test Title</title>
          <link rel="canonical" href="https://example.com/test" />
          <meta name="author" content="John Doe" />
          <meta property="article:published_time" content="2024-01-01" />
          <meta property="og:site_name" content="Example Site" />
        </head>
        <body>
          <h1>Page Title</h1>
        </body>
      </html>
    `;
    const metadata = extractMetadata(html, "https://example.com/page");
    expect(metadata.title).toBe("Test Title");
    expect(metadata.canonicalUrl).toBe("https://example.com/test");
    expect(metadata.author).toBe("John Doe");
    expect(metadata.datePublished).toBe("2024-01-01");
    expect(metadata.siteName).toBe("Example Site");
  });

  it("should fallback to h1 for title", () => {
    const html = `
      <html>
        <body>
          <h1>Page Title</h1>
        </body>
      </html>
    `;
    const metadata = extractMetadata(html, "https://example.com/page");
    expect(metadata.title).toBe("Page Title");
    expect(metadata.canonicalUrl).toBe("https://example.com/page");
  });

  it("should fallback to og:title if no title or h1", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="OG Title" />
        </head>
        <body>
          <p>Content</p>
        </body>
      </html>
    `;
    const metadata = extractMetadata(html, "https://example.com/page");
    expect(metadata.title).toBe("OG Title");
  });

  it("should handle missing optional metadata", () => {
    const html = `
      <html>
        <head>
          <title>Test Title</title>
        </head>
        <body></body>
      </html>
    `;
    const metadata = extractMetadata(html, "https://example.com/page");
    expect(metadata.title).toBe("Test Title");
    expect(metadata.canonicalUrl).toBe("https://example.com/page");
    expect(metadata.author).toBeUndefined();
    expect(metadata.datePublished).toBeUndefined();
    expect(metadata.dateModified).toBeUndefined();
    expect(metadata.siteName).toBeUndefined();
  });
});
