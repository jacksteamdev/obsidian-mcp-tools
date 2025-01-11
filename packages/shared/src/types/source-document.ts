import { type } from "arktype";

export const documentMetadataSchema = type({
  "canonicalUrl": "string",
  "title": "string",
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
