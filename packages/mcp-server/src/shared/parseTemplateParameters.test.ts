import { describe, expect, test } from "bun:test";
import { parseTemplateParameters } from "./parseTemplateParameters";
import { PromptParameterSchema } from "shared";

describe("parseTemplateParameters", () => {
  test("returns empty array for content without parameters", () => {
    const content = "No parameters here";
    const result = parseTemplateParameters(content);
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([]);
  });

  test("parses single parameter without description", () => {
    const content = '<% tp.mcpTools.prompt("name") %>';
    const result = parseTemplateParameters(content);
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([{ name: "name" }]);
  });

  test("parses single parameter with description", () => {
    const content = '<% tp.mcpTools.prompt("name", "Enter your name") %>';
    const result = parseTemplateParameters(content);
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([{ name: "name", description: "Enter your name" }]);
  });

  test("parses multiple parameters", () => {
    const content = `
      <% tp.mcpTools.prompt("name", "Enter your name") %>
      <% tp.mcpTools.prompt("age", "Enter your age") %>
    `;
    const result = parseTemplateParameters(content);
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([
      { name: "name", description: "Enter your name" },
      { name: "age", description: "Enter your age" },
    ]);
  });

  test("ignores invalid template syntax", () => {
    const content = `
    <% invalid.syntax %>
    <% tp.mcpTools.prompt("name", "Enter your name") %>
    `;
    const result = parseTemplateParameters(content);
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([{ name: "name", description: "Enter your name" }]);
  });

  test("skips template tags with unparseable code and continues parsing", () => {
    /**
     * Given content with a template tag containing syntax that cannot be parsed
     * When parseTemplateParameters is called
     * Then the malformed tag is skipped and subsequent valid tags are still parsed
     */

    // Given: a template with a syntax error followed by a valid parameter
    const content = `
      <% {{{invalid javascript %>
      <% tp.mcpTools.prompt("title", "Enter title") %>
    `;

    // When: parameters are parsed
    const result = parseTemplateParameters(content);

    // Then: the malformed tag is skipped, valid parameter is still extracted
    PromptParameterSchema.array().assert(result);
    expect(result).toEqual([{ name: "title", description: "Enter title" }]);
  });
});
