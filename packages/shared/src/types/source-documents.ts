import { type } from "arktype";

// Obsidian plugin feature settings

export const settings = type({
  enabled: "boolean",
  templatePath: type("string").describe("Path to Templater template file"),
  sourcesDirectory: type("string").describe(
    "Directory to store source documents",
  ),
  maxPageSize: type("number>0").describe("Maximum characters per page"),
});

export type Settings = typeof settings.infer;

// search_source schemas

export const searchParams = type({
  query: type("string>0").describe("Search query text"),
}).describe("Search for source documents");

export const searchResult = type({
  documentId: "string",
  metadata: "Record<string, unknown>",
  matchingBlock: "string",
});

export type SearchParams = typeof searchParams.infer;
export type SearchResult = typeof searchResult.infer;

// read_source schemas

/**
 * A schema for the parameters required to read a source document.
 *
 * @property {string} documentId - The unique identifier of the document to read.
 * @property {number>0} [page] - The page number to retrieve (defaults to 1).
 */
export const readParams = type({
  documentId: "string",
  "page?": type("number>0").describe("Page number (defaults to 1)"),
  "related?": type("boolean").describe(
    "Search for semantically related vault content",
  ),
});

/**
 * A schema that defines the structure of a page response, including the content, page number, and total number of pages.
 *
 * @property {string} content - The content of the page.
 * @property {number>0} pageNumber - The number of the current page (must be greater than 0).
 * @property {number>0} totalPages - The total number of pages (must be greater than 0).
 */
export const readResponse = type({
  content: "string",
  pageNumber: "number>0",
  totalPages: "number>0",
  "related?": searchResult.array(),
});

export type ReadParams = typeof readParams.infer;
export type ReadResponse = typeof readResponse.infer;

// create_source schemas

export const metadata = type({
  canonicalUrl: "string",
  title: "string",
  "dateModified?": "string",
  "datePublished?": "string",
  "author?": "string",
  "siteName?": "string",
});

export const createParams = type({
  url: type("string>0").describe("URL to fetch content from"),
  "update?": type("boolean").describe("Overwrite existing document"),
});

export const createResponse = type({
  documentId: "string",
  metadata: metadata,
  path: "string",
});

export type Metadata = typeof metadata.infer;
export type CreateParams = typeof createParams.infer;
export type CreateResponse = typeof createResponse.infer;
