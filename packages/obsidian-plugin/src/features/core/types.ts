import { type } from "arktype";
import { sourceDocumentSettingsSchema } from "../source-document";

const mcpToolsPluginSettingsSchema = type({
  sourceDocument: sourceDocumentSettingsSchema,
});

export type McpToolsPluginSettings = typeof mcpToolsPluginSettingsSchema.infer;
