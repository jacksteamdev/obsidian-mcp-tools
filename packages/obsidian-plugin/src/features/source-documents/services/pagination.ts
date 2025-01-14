import { splitIntoBlocks } from "../utils/blocks";

export interface PageExtraction {
  pageContent: string;
  pageNumber: number;
  totalPages: number;
}

/**
 * Extracts a specific page from content while preserving block boundaries.
 * @param content Full document content
 * @param pageNumber Page number to extract (1-based)
 * @param maxPageSize Maximum size of a page in characters
 */
export async function extractPage(
  content: string,
  pageNumber: number,
  maxPageSize: number,
): Promise<PageExtraction> {
  // 1. Split into blocks
  const blocks = splitIntoBlocks(content);

  // 2. Calculate pages
  const pages: string[] = [];
  let currentPage: string[] = [];
  let currentSize = 0;

  for (const block of blocks) {
    // Add block separator size for accurate page size calculation
    const blockSize = block.length + 2; // +2 for "\n\n"

    if (currentSize + blockSize > maxPageSize && currentPage.length > 0) {
      pages.push(currentPage.join("\n\n"));
      currentPage = [block];
      currentSize = blockSize;
    } else {
      currentPage.push(block);
      currentSize += blockSize;
    }
  }

  if (currentPage.length > 0) {
    pages.push(currentPage.join("\n\n"));
  }

  // 3. Validate page number
  const totalPages = pages.length || 1; // Ensure at least 1 page for empty content
  if (pageNumber < 1 || pageNumber > totalPages) {
    throw new Error(
      `Invalid page number: ${pageNumber}. Total pages: ${totalPages}`,
    );
  }

  return {
    pageContent: pages[pageNumber - 1] || "", // Return empty string for empty content
    pageNumber,
    totalPages,
  };
}
