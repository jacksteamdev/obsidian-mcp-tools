/**
 * BDD specs for buildTemplateArgumentsSchema and PromptFrontmatterSchema.
 *
 * Covers: buildTemplateArgumentsSchema, PromptFrontmatterSchema (.narrow() validator)
 */

// Public API surface (from packages/shared/src/types/prompts.ts):
//   buildTemplateArgumentsSchema(args: PromptParameter[]) -> Type<Record<string, "string" | "string?">>
//   Input: array of PromptParameter (name, optional description, optional required)
//   Output: arktype Type that validates an object with string fields matching the parameters
//   PromptFrontmatterSchema — validates frontmatter with tags containing 'mcp-tools-prompt'

import { type } from "arktype";
import { describe, expect, test } from "bun:test";
import { buildTemplateArgumentsSchema, PromptFrontmatterSchema } from "./prompts";

/**
 * REQUIREMENT: buildTemplateArgumentsSchema creates an arktype schema from
 *              prompt parameters that enforces required/optional string fields.
 *
 * WHO: The prompts feature, which validates user-supplied template arguments
 *      against the parameters declared in a template file
 * WHAT: 1. Required parameters produce required string fields in the schema
 *       2. Optional parameters produce optional string fields in the schema
 *       3. An empty parameter list produces a schema that accepts an empty object
 * WHY: Without schema validation, invalid or missing template arguments would
 *      cause silent failures or confusing errors at template execution time
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — this function is pure computation
 *     Real:  buildTemplateArgumentsSchema
 *     Never: construct arktype schemas directly — always use this builder
 */
describe("buildTemplateArgumentsSchema", () => {
  test("creates a schema with required string fields for required parameters", () => {
    /**
     * Given a parameter list with a required parameter
     * When buildTemplateArgumentsSchema is called
     * Then the resulting schema rejects objects missing the required field
     */

    // Given: a required parameter
    const args = [{ name: "title", required: true }];

    // When: the schema is built
    const schema = buildTemplateArgumentsSchema(args);

    // Then: an object with the field validates successfully
    const valid = schema({ title: "Hello" });
    expect(valid).toEqual({ title: "Hello" });

    // Then: an object missing the field fails validation
    const invalid = schema({});
    expect(invalid instanceof Error || String(invalid).includes("must")).toBe(true);
  });

  test("creates a schema with optional string fields for optional parameters", () => {
    /**
     * Given a parameter list with an optional parameter (required not set)
     * When buildTemplateArgumentsSchema is called
     * Then the resulting schema accepts objects with or without the field
     */

    // Given: an optional parameter
    const args = [{ name: "subtitle" }];

    // When: the schema is built
    const schema = buildTemplateArgumentsSchema(args);

    // Then: an object without the field validates successfully
    const withoutField = schema({});
    expect(withoutField).toEqual({});

    // Then: an object with the field also validates successfully
    const withField = schema({ subtitle: "World" });
    expect(withField).toEqual({ subtitle: "World" });
  });

  test("creates a schema accepting an empty object when no parameters are given", () => {
    /**
     * Given an empty parameter list
     * When buildTemplateArgumentsSchema is called
     * Then the resulting schema accepts an empty object
     */

    // Given: no parameters
    const args: Parameters<typeof buildTemplateArgumentsSchema>[0] = [];

    // When: the schema is built
    const schema = buildTemplateArgumentsSchema(args);

    // Then: an empty object validates successfully
    const result = schema({});
    expect(result).toEqual({});
  });
});

/**
 * REQUIREMENT: PromptFrontmatterSchema validates that frontmatter contains the
 *              required 'mcp-tools-prompt' tag via a .narrow() constraint.
 *
 * WHO: The prompts feature, which identifies prompt templates by their frontmatter tags
 * WHAT: 1. Frontmatter with the 'mcp-tools-prompt' tag validates successfully
 *       2. Frontmatter without the tag fails validation
 *       3. Frontmatter with additional tags alongside the prompt tag validates
 * WHY: Without tag validation, non-prompt files could be misidentified as prompt
 *      templates, causing confusing execution errors
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — schema validation is pure computation
 *     Real:  PromptFrontmatterSchema
 *     Never: mock arktype internals
 */
describe("PromptFrontmatterSchema", () => {
  test("accepts frontmatter containing the mcp-tools-prompt tag", () => {
    /**
     * Given frontmatter with tags including 'mcp-tools-prompt'
     * When the schema validates the data
     * Then validation succeeds and returns the input
     */

    // Given: frontmatter with the required tag
    const input = { tags: ["mcp-tools-prompt"] };

    // When: the schema validates
    const result = PromptFrontmatterSchema(input);

    // Then: it returns the valid data
    expect(result).toEqual({ tags: ["mcp-tools-prompt"] });
  });

  test("rejects frontmatter without the mcp-tools-prompt tag", () => {
    /**
     * Given frontmatter with tags that do not include 'mcp-tools-prompt'
     * When the schema validates the data
     * Then validation fails
     */

    // Given: frontmatter missing the required tag
    const input = { tags: ["some-other-tag"] };

    // When: the schema validates
    const result = PromptFrontmatterSchema(input);

    // Then: validation fails (arktype returns an error, not the data)
    expect(result instanceof type.errors).toBe(true);
  });

  test("accepts frontmatter with additional tags alongside the prompt tag", () => {
    /**
     * Given frontmatter with multiple tags including 'mcp-tools-prompt'
     * When the schema validates the data
     * Then validation succeeds
     */

    // Given: frontmatter with multiple tags
    const input = { tags: ["blog-post", "mcp-tools-prompt", "draft"] };

    // When: the schema validates
    const result = PromptFrontmatterSchema(input);

    // Then: it returns the valid data
    expect(result).toEqual({ tags: ["blog-post", "mcp-tools-prompt", "draft"] });
  });
});
