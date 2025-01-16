import { describe, it, expect } from "bun:test";
import { convertHtmlToMarkdown, extractMetadata } from "./markdown";

describe("convertHtmlToMarkdown", () => {
  it("should convert basic HTML to markdown", () => {
    const html = `
      <h1>Test Title</h1>
      <p>This is a test paragraph with <strong>bold</strong> text.</p>
      <ul>
        <li>Item 1</li>
        <li>Item 2</li>
      </ul>
    `;
    const result = convertHtmlToMarkdown(html, "https://example.com");
    expect(result).toInclude("# Test Title");
    expect(result).toInclude("This is a test paragraph with **bold** text.");
    expect(result).toInclude("- Item 1");
    expect(result).toInclude("- Item 2");
  });

  it("should resolve relative URLs", () => {
    const html = `
      <p>
        <a href="/page">Link</a>
        <img src="/image.jpg" alt="Test">
      </p>
    `;
    const result = convertHtmlToMarkdown(html, "https://example.com");
    expect(result).toInclude("https://example.com/page");
    expect(result).toInclude("https://example.com/image.jpg");
  });

  it("should handle article content", () => {
    const html = `
      <html>
        <head>
          <title>Page Title</title>
        </head>
        <body>
          <header>Site Header</header>
          <article>
            <h1>Article Title</h1>
            <p>Article content</p>
          </article>
          <footer>Site Footer</footer>
        </body>
      </html>
    `;
    const result = convertHtmlToMarkdown(html, "https://example.com");
    expect(result).toInclude("# Article Title");
    expect(result).toInclude("Article content");
    expect(result).not.toInclude("Site Header");
    expect(result).not.toInclude("Site Footer");
  });

  it("should clean up excessive whitespace", () => {
    const html = `
      <h1>Title</h1>


      <p>Paragraph 1</p>


      <p>Paragraph 2</p>
    `;
    const result = convertHtmlToMarkdown(html, "https://example.com");
    expect(result).toBe("# Title\n\nParagraph 1\n\nParagraph 2");
  });
});

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
