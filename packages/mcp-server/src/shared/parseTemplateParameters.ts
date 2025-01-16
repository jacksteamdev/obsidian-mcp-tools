import { parse } from "acorn";
import { simple } from "acorn-walk";
import { type } from "arktype";
import type { PromptParameter } from "shared";
import { logger } from "./logger";

const CallExpressionSchema = type({
  callee: {
    type: "'MemberExpression'",
    object: {
      type: "'MemberExpression'",
      object: { name: "'tp'" },
      property: { name: "'mcpTools'" },
    },
    property: { name: "'prompt'" },
  },
  arguments: type({ type: "'Literal'", value: "string" }).array(),
});

/**
 * Parses template arguments from the given content string.
 *
 * The function looks for template argument tags in the content string, which are
 * in the format `<% tp.mcpTools.prompt("name", "description") %>`, and extracts
 * the name and description of each argument. The extracted arguments are
 * returned as an array of `PromptArgument` objects.
 *
 * @param content - The content string to parse for template arguments.
 * @returns An array of `PromptArgument` objects representing the extracted
 * template arguments.
 */
export function parseTemplateParameters(content: string): PromptParameter[] {
  /**
   * Regular expressions for template tags.
   * The tags are in the format `<% tp.mcpTools.prompt("name", "description") %>`
   * and may contain additional modifiers.
   */
  const TEMPLATER_START_TAG = /<%[*-_]*/;
  const TEMPLATER_END_TAG = /[-_]*%>/;

  // Split content by template tags
  const parts = content.split(TEMPLATER_START_TAG);
  const parameters: PromptParameter[] = [];
  for (const part of parts) {
    if (!TEMPLATER_END_TAG.test(part)) continue;
    const code = part.split(TEMPLATER_END_TAG)[0].trim();

    try {
      // Parse the extracted code with AST
      const ast = parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
      });

      simple(ast, {
        CallExpression(node) {
          if (CallExpressionSchema.allows(node)) {
            const argName = node.arguments[0].value;
            const argDescription = node.arguments[1]?.value;
            parameters.push({
              name: argName,
              ...(argDescription ? { description: argDescription } : {}),
            });
          }
        },
      });
    } catch (error) {
      logger.error("Error parsing code", { code, error });
      continue;
    }
  }

  return parameters;
}
