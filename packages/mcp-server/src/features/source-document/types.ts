import { type } from "arktype";

export const createSourceSchema = type({
  name: '"create_source"',
  arguments: {
    url: type("string").describe("Valid URL to fetch content from"),
  },
}).describe("Create a new source document from a URL");

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
