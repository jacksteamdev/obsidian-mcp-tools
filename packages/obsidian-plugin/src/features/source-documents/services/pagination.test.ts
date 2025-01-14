import { describe, it, expect } from "bun:test";
import { extractPage } from "./pagination";

describe("extractPage", () => {
  const content = `
Block 1
This is the first block of content.

Block 2
This is the second block of content.

Block 3
This is the third block of content.

Block 4
This is the fourth block of content.
`.trim();

  it("extracts first page correctly", async () => {
    const result = await extractPage(content, 1, 50);
    expect(result.pageNumber).toBe(1);
    expect(result.pageContent).toContain("Block 1");
    expect(result.totalPages).toBeGreaterThan(1);
  });

  it("preserves block boundaries", async () => {
    const result = await extractPage(content, 1, 100);
    const blocks = result.pageContent.split("\n\n");
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks[0]).toContain("Block 1");
  });

  it("handles empty content", async () => {
    const result = await extractPage("", 1, 100);
    expect(result.pageContent).toBe("");
    expect(result.pageNumber).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it("throws error for invalid page number", async () => {
    await expect(extractPage(content, 0, 100)).rejects.toThrow("Invalid page number");
    await expect(extractPage(content, 999, 100)).rejects.toThrow("Invalid page number");
  });

  it("handles content smaller than page size", async () => {
    const smallContent = "Small block of content";
    const result = await extractPage(smallContent, 1, 1000);
    expect(result.pageContent).toBe(smallContent);
    expect(result.totalPages).toBe(1);
  });

  it("respects maxPageSize while preserving block integrity", async () => {
    const result = await extractPage(content, 1, 30);
    // Should contain exactly one block, even if it exceeds maxPageSize
    expect(result.pageContent.split("\n\n").length).toBe(1);
    // Should not cut blocks in the middle
    expect(result.pageContent).not.toMatch(/\n\n.*$/);
    // Should contain the complete first block
    expect(result.pageContent).toBe("Block 1\nThis is the first block of content.");
  });
});
