import { logger, type SmartConnections } from "$/shared";
import { App, prepareFuzzySearch } from "obsidian";
import { findMatchingBlock } from "../utils/blocks";
import { SettingsManager } from "./settings";
import type { SourceDocumentSearchResult } from "../types";

/**
 * Search source documents using Smart Connections if available,
 * falling back to fuzzy search
 */
export async function searchDocuments(
  app: App,
  searchTerm: string,
  sourcesDirectory: string,
  smartSearch?: SmartConnections.SmartSearch,
): Promise<SourceDocumentSearchResult[]> {
  try {
    // Try Smart Connections first if available
    if (smartSearch) {
      logger.info("Using Smart Connections for search");
      const results = await smartSearch.search(searchTerm, {
        key_starts_with: sourcesDirectory,
      });

      return await Promise.all(
        results.map(async (result) => ({
          documentId: getDocumentId(result.item.path, sourcesDirectory),
          metadata: await SettingsManager.getMetadata(app, result.item.path),
          matchingBlock: await result.item.read(),
        })),
      );
    }

    // Fall back to fuzzy search
    logger.info("Smart Connections not available, using fuzzy search");
    const fuzzySearch = prepareFuzzySearch(searchTerm);
    const results: SourceDocumentSearchResult[] = [];

    // Get all files in source directory
    const files = app.vault
      .getFiles()
      .filter((file) => file.path.startsWith(sourcesDirectory));

    // Search each file
    for (const file of files) {
      const content = await app.vault.read(file);
      const match = findMatchingBlock(content, fuzzySearch);

      if (match) {
        results.push({
          documentId: getDocumentId(file.path, sourcesDirectory),
          metadata: await SettingsManager.getMetadata(app, file.path),
          matchingBlock: match,
        });
      }
    }

    return results;
  } catch (error) {
    logger.error("Search error:", {
      error: error instanceof Error ? error.message : error,
      query: searchTerm,
    });
    throw error;
  }
}

/**
 * Extract document ID from file path by removing source directory prefix
 * and .md extension
 */
function getDocumentId(path: string, sourcesDirectory: string): string {
  return path.replace(`${sourcesDirectory}/`, "").replace(".md", "");
}
