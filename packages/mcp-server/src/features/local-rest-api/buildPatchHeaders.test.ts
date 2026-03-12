/**
 * BDD specs for buildPatchHeaders.
 *
 * Covers: TestBuildPatchHeadersRequiredFields,
 *         TestBuildPatchHeadersOptionalFields,
 *         TestBuildPatchHeadersCreateTargetIfMissing
 */

// Public API surface (from src/features/local-rest-api/buildPatchHeaders.ts):
//   buildPatchHeaders(args: ApiPatchParameters) -> Record<string, string>
//   Input: parsed ApiPatchParameters (operation, targetType, target, and optionals)
//   Output: Record<string, string> suitable for HTTP headers

import { describe, expect, test } from "bun:test";
import { buildPatchHeaders } from "./buildPatchHeaders";

/**
 * REQUIREMENT: Required patch parameters are always mapped to HTTP headers.
 *
 * WHO: The local-rest-api patch handlers (patch_active_file, patch_vault_file)
 * WHAT: The three required fields (operation, targetType, target) are always
 *       present in the returned headers under their HTTP header names
 * WHY: The Obsidian Local REST API requires Operation, Target-Type, and Target
 *      headers on every PATCH request; omitting any causes a silent failure
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — this function is pure computation
 *     Real:  buildPatchHeaders
 *     Never: construct headers directly — always obtain via buildPatchHeaders()
 */
describe("buildPatchHeaders — required fields", () => {
  test("maps operation, targetType, and target to HTTP headers", () => {
    /**
     * Given required fields for a patch operation
     * When buildPatchHeaders is called with those fields
     * Then the returned headers contain Operation, Target-Type, and Target
     */

    // Given: a minimal set of required patch parameters
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "Section Title",
      content: "New content paragraph",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: all three required headers are present with correct values
    expect(headers["Operation"]).toBe(
      "append",
      // diagnostic: "Operation header should map directly from args.operation"
    );
    expect(headers["Target-Type"]).toBe(
      "heading",
      // diagnostic: "Target-Type header should map directly from args.targetType"
    );
    expect(headers["Target"]).toBe(
      "Section Title",
      // diagnostic: "Target header should map directly from args.target"
    );
  });

  test("does not include optional headers when optional fields are omitted", () => {
    /**
     * Given only required fields are provided
     * When buildPatchHeaders is called
     * Then optional headers (Target-Delimiter, Trim-Target-Whitespace,
     *      Content-Type, Create-Target-If-Missing) are absent
     */

    // Given: only required fields
    const args = {
      operation: "replace" as const,
      targetType: "block" as const,
      target: "block-ref-id",
      content: "Replacement text",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: no optional headers are present
    expect(headers).not.toHaveProperty(
      "Target-Delimiter",
      // diagnostic: "Target-Delimiter should be absent when targetDelimiter is not provided"
    );
    expect(headers).not.toHaveProperty(
      "Trim-Target-Whitespace",
      // diagnostic: "Trim-Target-Whitespace should be absent when trimTargetWhitespace is not provided"
    );
    expect(headers).not.toHaveProperty(
      "Content-Type",
      // diagnostic: "Content-Type should be absent when contentType is not provided"
    );
    expect(headers).not.toHaveProperty(
      "Create-Target-If-Missing",
      // diagnostic: "Create-Target-If-Missing should be absent when createTargetIfMissing is not provided"
    );
  });
});

/**
 * REQUIREMENT: Optional patch parameters are conditionally mapped to HTTP headers.
 *
 * WHO: The local-rest-api patch handlers
 * WHAT: When targetDelimiter, trimTargetWhitespace, or contentType are provided,
 *       they appear in the headers under the correct HTTP header names;
 *       boolean values are serialized as strings
 * WHY: The Obsidian Local REST API uses custom HTTP headers for patch options;
 *      incorrect or missing mapping causes the API to use wrong defaults
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — this function is pure computation
 *     Real:  buildPatchHeaders
 *     Never: construct headers directly — always obtain via buildPatchHeaders()
 */
describe("buildPatchHeaders — optional fields", () => {
  test("includes Target-Delimiter header when targetDelimiter is provided", () => {
    /**
     * Given a targetDelimiter value is specified
     * When buildPatchHeaders is called
     * Then the Target-Delimiter header is present with that value
     */

    // Given: args with a custom delimiter
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "Parent > Child",
      content: "Content under child heading",
      targetDelimiter: ">",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Target-Delimiter is set to the provided value
    expect(headers["Target-Delimiter"]).toBe(
      ">",
      // diagnostic: "Target-Delimiter should match the provided targetDelimiter"
    );
  });

  test("includes Trim-Target-Whitespace header as string when trimTargetWhitespace is true", () => {
    /**
     * Given trimTargetWhitespace is set to true
     * When buildPatchHeaders is called
     * Then the Trim-Target-Whitespace header is "true" (string, not boolean)
     */

    // Given: args with trimTargetWhitespace enabled
    const args = {
      operation: "replace" as const,
      targetType: "heading" as const,
      target: "  Heading With Spaces  ",
      content: "Trimmed content",
      trimTargetWhitespace: true,
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Trim-Target-Whitespace is the string "true"
    expect(headers["Trim-Target-Whitespace"]).toBe(
      "true",
      // diagnostic: "Trim-Target-Whitespace must be string 'true', not boolean true"
    );
  });

  test("includes Trim-Target-Whitespace header as string when trimTargetWhitespace is false", () => {
    /**
     * Given trimTargetWhitespace is explicitly set to false
     * When buildPatchHeaders is called
     * Then the Trim-Target-Whitespace header is "false" (string)
     */

    // Given: args with trimTargetWhitespace explicitly disabled
    const args = {
      operation: "replace" as const,
      targetType: "heading" as const,
      target: "Heading",
      content: "Content",
      trimTargetWhitespace: false,
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Trim-Target-Whitespace is the string "false"
    expect(headers["Trim-Target-Whitespace"]).toBe(
      "false",
      // diagnostic: "Trim-Target-Whitespace must be string 'false' when explicitly set to false"
    );
  });

  test("includes Content-Type header when contentType is provided", () => {
    /**
     * Given a contentType value is specified
     * When buildPatchHeaders is called
     * Then the Content-Type header is present with that value
     */

    // Given: args with JSON content type
    const args = {
      operation: "replace" as const,
      targetType: "frontmatter" as const,
      target: "tags",
      content: '["tag1", "tag2"]',
      contentType: "application/json" as const,
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Content-Type is set to the provided value
    expect(headers["Content-Type"]).toBe(
      "application/json",
      // diagnostic: "Content-Type should match the provided contentType"
    );
  });
});

/**
 * REQUIREMENT: createTargetIfMissing is conditionally mapped to the
 *              Create-Target-If-Missing HTTP header.
 *
 * WHO: The local-rest-api patch handlers
 * WHAT: When createTargetIfMissing is true, the header is "true";
 *       when false, the header is "false";
 *       when omitted, the header is absent entirely
 * WHY: Previously hardcoded to "true", which created targets unconditionally.
 *      Agents must explicitly opt in to target creation to avoid unintended
 *      modifications to vault structure.
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — this function is pure computation
 *     Real:  buildPatchHeaders
 *     Never: construct headers directly — always obtain via buildPatchHeaders()
 */
describe("buildPatchHeaders — createTargetIfMissing", () => {
  test("includes Create-Target-If-Missing as 'true' when set to true", () => {
    /**
     * Given createTargetIfMissing is true
     * When buildPatchHeaders is called
     * Then the Create-Target-If-Missing header is the string "true"
     */

    // Given: args opting in to target creation
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "New Section",
      content: "Content for new section",
      createTargetIfMissing: true,
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Create-Target-If-Missing is "true"
    expect(headers["Create-Target-If-Missing"]).toBe(
      "true",
      // diagnostic: "Create-Target-If-Missing must be string 'true' when opted in"
    );
  });

  test("includes Create-Target-If-Missing as 'false' when explicitly set to false", () => {
    /**
     * Given createTargetIfMissing is explicitly false
     * When buildPatchHeaders is called
     * Then the Create-Target-If-Missing header is the string "false"
     */

    // Given: args explicitly opting out of target creation
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "Existing Section",
      content: "Appended content",
      createTargetIfMissing: false,
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Create-Target-If-Missing is "false"
    expect(headers["Create-Target-If-Missing"]).toBe(
      "false",
      // diagnostic: "Create-Target-If-Missing must be string 'false' when explicitly opted out"
    );
  });

  test("omits Create-Target-If-Missing header when createTargetIfMissing is not provided", () => {
    /**
     * Given createTargetIfMissing is omitted from args
     * When buildPatchHeaders is called
     * Then the Create-Target-If-Missing header is absent
     */

    // Given: args without createTargetIfMissing
    const args = {
      operation: "prepend" as const,
      targetType: "heading" as const,
      target: "Existing Section",
      content: "Prepended content",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: Create-Target-If-Missing is not in the headers
    expect(headers).not.toHaveProperty(
      "Create-Target-If-Missing",
      // diagnostic: "Create-Target-If-Missing should be absent when not provided — the old hardcoded 'true' behavior is the bug this fixes"
    );
  });
});
