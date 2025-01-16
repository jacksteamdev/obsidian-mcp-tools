import type { SearchResult } from "obsidian";

/**
 * Splits content into logical blocks based on double newlines.
 * Handles whitespace normalization and removes empty blocks.
 */
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

/**
 * Find the first block of text that matches the fuzzy search criteria
 */
export function findMatchingBlock(
  content: string,
  fuzzySearch: (text: string) => SearchResult | null,
): string | null {
  const blocks = splitIntoBlocks(content);

  // Return first matching block
  for (const block of blocks) {
    if (fuzzySearch(block)) {
      return block;
    }
  }

  return null;
}
