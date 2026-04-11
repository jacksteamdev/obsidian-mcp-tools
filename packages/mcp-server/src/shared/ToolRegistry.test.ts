import { describe, expect, test } from "bun:test";
import { normalizeInputSchema } from "./ToolRegistry";

describe("normalizeInputSchema", () => {
  test("adds missing properties key to an otherwise valid object schema", () => {
    const input = { type: "object", additionalProperties: true };
    const out = normalizeInputSchema(input);
    expect(out).toEqual({
      type: "object",
      additionalProperties: true,
      properties: {},
    });
  });

  test("preserves an existing properties key unchanged", () => {
    const input = {
      type: "object",
      properties: {
        query: { type: "string" },
      },
      required: ["query"],
    };
    const out = normalizeInputSchema(input);
    expect(out.properties).toEqual({ query: { type: "string" } });
    expect(out.required).toEqual(["query"]);
  });

  test("adds both type and properties when the input is a bare empty object", () => {
    // This is the scenario ArkType produces for `arguments: {}`:
    // its JSON schema output is already well-formed, but this test
    // verifies the wrapper does not regress when given a minimal shape.
    const input = {};
    const out = normalizeInputSchema(input);
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({});
  });

  test("does not mutate the input object", () => {
    const input: Record<string, unknown> = { type: "object" };
    normalizeInputSchema(input);
    expect(input).toEqual({ type: "object" });
    expect("properties" in input).toBe(false);
  });

  test("falls back to a valid empty schema when input is null", () => {
    // Defensive guard: if something returns null from toJsonSchema()
    // we still want a protocol-valid schema, not a crash.
    const out = normalizeInputSchema(null);
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({});
  });

  test("falls back to a valid empty schema when input is a primitive", () => {
    const out = normalizeInputSchema("not an object" as unknown);
    expect(out.type).toBe("object");
    expect(out.properties).toEqual({});
  });

  test("leaves an existing type key untouched even if not 'object'", () => {
    // Pathological but preserved: if something upstream explicitly
    // marks a schema as non-object, we log the caller's intent.
    // (In practice MCP will reject this at the protocol level, but
    // normalizeInputSchema is not the right place to enforce it.)
    const input = { type: "string" };
    const out = normalizeInputSchema(input);
    expect(out.type).toBe("string");
    expect(out.properties).toEqual({});
  });
});
