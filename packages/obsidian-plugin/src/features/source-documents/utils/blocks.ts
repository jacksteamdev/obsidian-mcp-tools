/**
 * Splits content into logical blocks based on double newlines.
 * Handles whitespace normalization and removes empty blocks.
 */
export function splitIntoBlocks(content: string): string[] {
  return content
    // Split on double newline
    .split(/\n\s*\n/)
    // Remove empty blocks
    .filter(block => block.trim().length > 0)
    // Normalize whitespace
    .map(block => block.trim());
}
