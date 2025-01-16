import { describe, it, expect } from "bun:test";
import { splitIntoBlocks } from "./blocks";

describe("splitIntoBlocks", () => {
  it("splits content on double newlines", () => {
    const content = "Block 1\n\nBlock 2\n\nBlock 3";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual(["Block 1", "Block 2", "Block 3"]);
  });

  it("handles extra whitespace between blocks", () => {
    const content = "Block 1\n\n\n\nBlock 2\n\n  \n\nBlock 3";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual(["Block 1", "Block 2", "Block 3"]);
  });

  it("removes empty blocks", () => {
    const content = "Block 1\n\n\n\nBlock 2\n\n  \n\n";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual(["Block 1", "Block 2"]);
  });

  it("trims whitespace from blocks", () => {
    const content = "  Block 1  \n\n  Block 2  \n\n  Block 3  ";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual(["Block 1", "Block 2", "Block 3"]);
  });

  it("handles single block content", () => {
    const content = "Single Block";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual(["Single Block"]);
  });

  it("handles empty content", () => {
    const content = "";
    const blocks = splitIntoBlocks(content);
    expect(blocks).toEqual([]);
  });
});
