import { Type, type } from "arktype";

/**
 * A Templater user function that retrieves the value of the specified argument from the `params.arguments` object. In this implementation, all arguments are optional.
 *
 * @param argName - The name of the argument to retrieve.
 * @param argDescription - A description of the argument.
 * @returns The value of the specified argument.
 *
 * @example
 * ```markdown
 * <% tp.mcpTools.prompt("argName", "Argument description") %>
 * ```
 */
export interface PromptArgAccessor {
  (argName: string, argDescription?: string): string;
}

export const PromptParameterSchema = type({
  name: "string",
  "description?": "string",
  "required?": "boolean",
});
export type PromptParameter = typeof PromptParameterSchema.infer;

export const PromptMetadataSchema = type({
  name: "string",
  "description?": type("string").describe("Description of the prompt"),
  "arguments?": PromptParameterSchema.array(),
});
export type PromptMetadata = typeof PromptMetadataSchema.infer;

export const PromptTemplateTag = type("'mcp-server-prompt'");
export const PromptFrontmatterSchema = type({
  tags: type("string[]").narrow((arr) => arr.some(PromptTemplateTag.allows)),
  "description?": type("string"),
});
export type PromptFrontmatter = typeof PromptFrontmatterSchema.infer;

export const PromptValidationErrorSchema = type({
  type: "'MISSING_REQUIRED_ARG'|'INVALID_ARG_VALUE'",
  message: "string",
  "argumentName?": "string",
});
export type PromptValidationError = typeof PromptValidationErrorSchema.infer;

export const PromptExecutionResultSchema = type({
  content: "string",
  "errors?": PromptValidationErrorSchema.array(),
});
export type PromptExecutionResult = typeof PromptExecutionResultSchema.infer;

export function buildTemplateArgumentsSchema(
  args: PromptParameter[],
): Type<Record<string, "string" | "string?">, {}> {
  return type(
    Object.fromEntries(
      args.map((arg) => [arg.name, arg.required ? "string" : "string?"]),
    ) as Record<string, "string" | "string?">,
  );
}
