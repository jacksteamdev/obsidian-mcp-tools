import { type } from "arktype";

// read_source schemas

/**
 * A schema for the parameters required to read a source document.
 *
 * @property {string} documentId - The unique identifier of the document to read.
 * @property {number>0} [page] - The page number to retrieve (defaults to 1).
 */
export const readSourceSchema = type({
  documentId: "string",
  "page?": type("number>0").describe("Page number (defaults to 1)"),
});

/**
 * A schema that defines the structure of a page response, including the content, page number, and total number of pages.
 *
 * @property {string} content - The content of the page.
 * @property {number>0} pageNumber - The number of the current page (must be greater than 0).
 * @property {number>0} totalPages - The total number of pages (must be greater than 0).
 */
export const pageResponseSchema = type({
  content: "string",
  pageNumber: "number>0",
  totalPages: "number>0",
});

export type ReadSourceParams = typeof readSourceSchema.infer;
export type PageResponse = typeof pageResponseSchema.infer;

// create_source schemas

export const documentMetadataSchema = type({
  canonicalUrl: "string",
  title: "string",
  "dateModified?": "string",
  "datePublished?": "string",
  "author?": "string",
  "siteName?": "string",
});

export type DocumentMetadata = typeof documentMetadataSchema.infer;

export type CreateSourceResponse = {
  documentId: string;
  metadata: DocumentMetadata;
  path: string;
};

export type CreateSourceError = {
  error: string;
  details?: string;
};
