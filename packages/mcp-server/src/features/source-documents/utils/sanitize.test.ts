import { describe, expect, it } from "bun:test";
import { sanitizeTitle, documentIdSchema } from "./sanitize";

describe("sanitizeTitle", () => {
  it("should remove author and website info after separators", () => {
    expect(sanitizeTitle("How to Build a CLI - John Doe")).toBe(
      "How to Build a CLI",
    );
    expect(sanitizeTitle("JavaScript Tips | Example.com")).toBe(
      "JavaScript Tips",
    );
  });

  it("should handle multiple separators correctly", () => {
    expect(sanitizeTitle("Title - Author | Website")).toBe("Title");
  });

  it("should replace invalid filename characters", () => {
    expect(sanitizeTitle("File: Test/Example?")).toBe("File- Test-Example");
  });

  it("should handle Unicode characters", () => {
    expect(sanitizeTitle("深入理解 JavaScript - 编程指南")).toBe(
      "深入理解 JavaScript",
    );
    expect(sanitizeTitle("プログラミング入門")).toBe("プログラミング入門");
  });

  it("should trim and handle dashes correctly", () => {
    expect(sanitizeTitle(" Test -- Title ")).toBe("Test - Title");
    expect(sanitizeTitle("-Leading-Trailing-")).toBe("Leading-Trailing");
  });

  it("should limit length to 100 characters", () => {
    const longTitle = "A".repeat(150);
    expect(sanitizeTitle(longTitle)).toHaveLength(100);
  });
});

describe("documentIdSchema", () => {
  it("should allow valid document IDs", () => {
    expect(documentIdSchema.allows("valid-document")).toBe(true);
    expect(documentIdSchema.allows("测试文档")).toBe(true);
    expect(documentIdSchema.allows("a".repeat(100))).toBe(true);
  });

  it("should reject invalid document IDs", () => {
    expect(documentIdSchema.allows("")).toBe(false);
    expect(documentIdSchema.allows("a".repeat(101))).toBe(false);
    expect(documentIdSchema.allows("invalid:name")).toBe(false);
    expect(documentIdSchema.allows("???")).toBe(false);
    expect(documentIdSchema.allows("test:file")).toBe(false);
    expect(documentIdSchema.allows("a".repeat(105))).toBe(false);
  });
});
