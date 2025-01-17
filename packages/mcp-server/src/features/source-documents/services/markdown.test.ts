import { describe, it, expect } from "bun:test";
import { convertHtmlToMarkdown } from "./markdown";

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
    expect(result).not.toInclude("https://example.com/image.jpg");
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
