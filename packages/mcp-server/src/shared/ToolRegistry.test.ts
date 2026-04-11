import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import { normalizeInputSchema, ToolRegistryClass } from "./ToolRegistry";

/**
 * Minimal fake MCP Server context, just enough to satisfy the handler
 * signature. We never hit the network or the real SDK in these tests.
 */
const fakeContext = { server: {} as never };

/**
 * Build a `ToolRegistryClass` prepopulated with two no-op tools. Used
 * by the disable/dispatch tests below to avoid repeating boilerplate.
 */
function buildRegistryWithTwoTools() {
  const tools = new ToolRegistryClass();

  const alphaSchema = type({
    name: '"alpha"',
    arguments: {},
  }).describe("Alpha tool");

  const betaSchema = type({
    name: '"beta"',
    arguments: {},
  }).describe("Beta tool");

  tools.register(alphaSchema, async () => ({
    content: [{ type: "text", text: "alpha-ok" }],
  }));
  tools.register(betaSchema, async () => ({
    content: [{ type: "text", text: "beta-ok" }],
  }));

  return { tools, alphaSchema, betaSchema };
}

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

describe("ToolRegistry enable/disable", () => {
  test("list() hides a disabled tool", () => {
    const { tools, alphaSchema } = buildRegistryWithTwoTools();

    // Baseline: both tools are enabled.
    expect(tools.list().tools.map((t) => t.name)).toEqual(["alpha", "beta"]);

    tools.disable(alphaSchema);

    expect(tools.list().tools.map((t) => t.name)).toEqual(["beta"]);
  });

  test("dispatch() on a disabled tool throws Unknown tool", async () => {
    const { tools, alphaSchema } = buildRegistryWithTwoTools();

    tools.disable(alphaSchema);

    // A disabled tool must be indistinguishable from an unregistered
    // one — otherwise `list()` and `dispatch()` would disagree.
    expect(
      tools.dispatch({ name: "alpha", arguments: {} }, fakeContext),
    ).rejects.toThrow(/Unknown tool: alpha/);
  });

  test("dispatch() still works for other enabled tools after one is disabled", async () => {
    const { tools, alphaSchema } = buildRegistryWithTwoTools();

    tools.disable(alphaSchema);

    const result = await tools.dispatch(
      { name: "beta", arguments: {} },
      fakeContext,
    );
    expect(result).toEqual({
      content: [{ type: "text", text: "beta-ok" }],
    });
  });

  test("disableByName returns true for a known tool and disables it", () => {
    const { tools } = buildRegistryWithTwoTools();

    const result = tools.disableByName("alpha");

    expect(result).toBe(true);
    expect(tools.list().tools.map((t) => t.name)).toEqual(["beta"]);
  });

  test("disableByName returns false for an unknown tool and is a no-op", () => {
    const { tools } = buildRegistryWithTwoTools();

    const result = tools.disableByName("nonexistent");

    expect(result).toBe(false);
    // Both tools still listed.
    expect(tools.list().tools.map((t) => t.name)).toEqual(["alpha", "beta"]);
  });
});
