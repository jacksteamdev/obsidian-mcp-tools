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
    // Operation header should map directly from args.operation
    expect(headers["Operation"]).toBe("append");
    // Target-Type header should map directly from args.targetType
    expect(headers["Target-Type"]).toBe("heading");
    // Target header should be URL-encoded from args.target
    expect(headers["Target"]).toBe("Section%20Title");
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
    // Target-Delimiter should be absent when targetDelimiter is not provided
    expect(headers).not.toHaveProperty("Target-Delimiter");
    // Trim-Target-Whitespace should be absent when trimTargetWhitespace is not provided
    expect(headers).not.toHaveProperty("Trim-Target-Whitespace");
    // Content-Type should be absent when contentType is not provided
    expect(headers).not.toHaveProperty("Content-Type");
    // Create-Target-If-Missing should be absent when createTargetIfMissing is not provided
    expect(headers).not.toHaveProperty("Create-Target-If-Missing");
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
    expect(headers["Target-Delimiter"]).toBe(">");
    // Then: Target segments are encoded but the custom delimiter is preserved
    expect(headers["Target"]).toBe("Parent%20>%20Child");
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

    // Then: Trim-Target-Whitespace is the string "true", not boolean true
    expect(headers["Trim-Target-Whitespace"]).toBe("true");
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

    // Then: Trim-Target-Whitespace is the string "false", not omitted
    expect(headers["Trim-Target-Whitespace"]).toBe("false");
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
    expect(headers["Content-Type"]).toBe("application/json");
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
    expect(headers["Create-Target-If-Missing"]).toBe("true");
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
    expect(headers["Create-Target-If-Missing"]).toBe("false");
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

    // Then: Create-Target-If-Missing is not in the headers — the old hardcoded 'true' behavior is the bug this fixes
    expect(headers).not.toHaveProperty("Create-Target-If-Missing");
  });
});

/**
 * REQUIREMENT: Non-ASCII and special characters in the Target header are
 *              URL-encoded per-segment to produce valid HTTP headers.
 *
 * WHO: Users with non-ASCII headings (Polish diacritics, CJK, emoji, etc.)
 *      and headings containing API-special characters ('/', '#')
 * WHAT: 1. Non-ASCII characters in heading targets are URL-encoded
 *       2. API-special characters ('/', '#') within heading names are encoded
 *       3. The heading path delimiter ('::' by default) is preserved unencoded
 *       4. Plain ASCII targets without special characters are encoded (spaces → %20)
 *       5. A custom delimiter is preserved unencoded while segments are encoded
 * WHY: HTTP/1.1 headers must contain only visible ASCII characters plus SP/HTAB;
 *      non-ASCII bytes cause transport-level failures. The Obsidian Local REST API
 *      requires '/' and '#' to be URL-encoded to avoid ambiguity in target parsing.
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — this function is pure computation
 *     Real:  buildPatchHeaders
 *     Never: construct headers directly — always obtain via buildPatchHeaders()
 */
describe("buildPatchHeaders — target URL-encoding", () => {
  test("encodes non-ASCII characters in heading targets", () => {
    /**
     * Given a heading target containing Polish diacritics
     * When buildPatchHeaders is called
     * Then the Target header contains URL-encoded non-ASCII characters
     */

    // Given: a heading with Polish diacritics
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "Wstęp do projektu",
      content: "New paragraph",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: non-ASCII characters are URL-encoded
    expect(headers["Target"]).toBe("Wst%C4%99p%20do%20projektu");
  });

  test("encodes API-special characters within heading names", () => {
    /**
     * Given a heading target containing '/' and '#' characters
     * When buildPatchHeaders is called
     * Then those characters are URL-encoded in the Target header
     */

    // Given: a heading path with special characters in segment names
    const args = {
      operation: "replace" as const,
      targetType: "heading" as const,
      target: "Root Heading::coddingtonbear/markdown-patch",
      content: "Updated content",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: '/' is encoded but the '::' delimiter is preserved
    expect(headers["Target"]).toBe(
      "Root%20Heading::coddingtonbear%2Fmarkdown-patch",
    );
  });

  test("preserves default delimiter while encoding segments", () => {
    /**
     * Given a multi-segment heading path with non-ASCII in each segment
     * When buildPatchHeaders is called
     * Then each segment is encoded individually and '::' delimiters are preserved
     */

    // Given: a multi-level heading path with Polish diacritics
    const args = {
      operation: "prepend" as const,
      targetType: "heading" as const,
      target: "Główny::Podrozdział::Szczegóły",
      content: "Prepended text",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: each segment is encoded, '::' delimiters are preserved
    expect(headers["Target"]).toBe(
      "G%C5%82%C3%B3wny::Podrozdzia%C5%82::Szczeg%C3%B3%C5%82y",
    );
  });

  test("preserves custom delimiter while encoding segments", () => {
    /**
     * Given a heading path using a custom delimiter with non-ASCII segments
     * When buildPatchHeaders is called with a targetDelimiter
     * Then segments are encoded individually and the custom delimiter is preserved
     */

    // Given: a heading path with custom '>' delimiter and non-ASCII
    const args = {
      operation: "append" as const,
      targetType: "heading" as const,
      target: "Résumé>Éducation",
      content: "Details",
      targetDelimiter: ">",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: segments are encoded, custom delimiter '>' is preserved
    expect(headers["Target"]).toBe("R%C3%A9sum%C3%A9>%C3%89ducation");
  });

  test("encodes block reference targets as a single value", () => {
    /**
     * Given a block reference target containing no delimiter
     * When buildPatchHeaders is called
     * Then the entire target is encoded as one segment
     */

    // Given: a block target that is ASCII-safe (no encoding needed)
    const args = {
      operation: "replace" as const,
      targetType: "block" as const,
      target: "block-ref-123",
      content: "Replaced block",
    };

    // When: headers are built
    const headers = buildPatchHeaders(args);

    // Then: ASCII-safe target is passed through (encodeURIComponent is a no-op for these chars)
    expect(headers["Target"]).toBe("block-ref-123");
  });
});
