import { type } from "arktype";
import { SourceDocuments } from "shared";

const mcpToolsPluginSettingsSchema = type({
  sourceDocument: SourceDocuments.settings,
});

export type McpToolsPluginSettings = typeof mcpToolsPluginSettingsSchema.infer;
