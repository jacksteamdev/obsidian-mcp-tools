import { type } from "arktype";

export const documentMetadataSchema = type({
  canonicalUrl: "string",
  title: "string",
  "dateModified?": "string",
  "datePublished?": "string",
  "author?": "string",
  "siteName?": "string",
});

export type CreateSourceParams = typeof createSourceSchema.infer;
export type DocumentMetadata = typeof documentMetadataSchema.infer;

// Response types
export type CreateSourceResponse = {
  documentId: string;
  metadata: DocumentMetadata;
  path: string;
};

export type CreateSourceError = {
  error: string;
  details?: string;
};

export const createSourceSchema = type({
  name: "'create_source'",
  arguments: {
    url: type("string>0").describe("URL to fetch content from"),
  },
}).describe("Create a source document from a URL");

export const searchSourceSchema = type({
  query: type("string>0").describe("Search query text"),
}).describe("Search for source documents");

export const searchResultSchema = type({
  documentId: "string",
  metadata: "Record<string, string | string[]>",
  matchingBlock: "string",
});

export type SearchSourceParams = typeof searchSourceSchema.infer;
export type SearchResult = typeof searchResultSchema.infer;
