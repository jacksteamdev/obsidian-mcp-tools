import { type } from "arktype";

export const sourceDocumentSettingsSchema = type({
  enabled: "boolean",
  templatePath: type("string").describe("Path to Templater template file"),
  sourcesDirectory: type("string").describe(
    "Directory to store source documents",
  ),
  maxPageSize: type("number>0").describe("Maximum characters per page"),
});

// Svelte VSCode extension >= 109 can't handle arktype inferred types
export type SourceDocumentSettings = typeof sourceDocumentSettingsSchema.infer;
