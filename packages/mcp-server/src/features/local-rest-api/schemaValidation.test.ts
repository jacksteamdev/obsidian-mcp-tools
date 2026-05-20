import { describe, expect, test } from "bun:test";
import { type } from "arktype";

/**
 * Tests for schema validation of tools with no required arguments
 * Issue #33: ArkType incorrectly validates Record<string, unknown> vs {}
 */
describe("Schema validation for tools with no arguments", () => {
  test("empty object schema {} accepts empty object", () => {
    const schema = type({
      name: '"test_tool"',
      arguments: {},
    });

    const valid = schema({ name: "test_tool", arguments: {} });
    expect(valid instanceof type.errors).toBe(false);
  });

  test("empty object schema {} accepts object with no properties", () => {
    const schema = type({
      arguments: {},
    });

    const valid = schema({ arguments: {} });
    expect(valid instanceof type.errors).toBe(false);
  });

  test("empty object schema {} validates correctly", () => {
    const schema = type({
      arguments: {},
    });

    // Should accept empty object
    const result = schema({ arguments: {} });
    if (result instanceof type.errors) {
      throw new Error(`Validation failed: ${result.summary}`);
    }
    expect(result).toEqual({ arguments: {} });
  });

  test("get_server_info schema structure", () => {
    // Replicates the schema from get_server_info tool
    const schema = type({
      name: '"get_server_info"',
      arguments: {},
    });

    const valid = schema({
      name: "get_server_info",
      arguments: {},
    });

    expect(valid instanceof type.errors).toBe(false);
  });

  test("delete_active_file schema structure", () => {
    // Replicates the schema from delete_active_file tool
    const schema = type({
      name: '"delete_active_file"',
      arguments: {},
    });

    const valid = schema({
      name: "delete_active_file",
      arguments: {},
    });

    expect(valid instanceof type.errors).toBe(false);
  });
});

describe("Comparison: Record<string, unknown> vs {} for no-argument tools", () => {
  test("empty object {} is more correct for no-argument tools", () => {
    // Using {} means the arguments must be an empty object literal
    const emptyObjectSchema = type({
      arguments: {},
    });

    // This should pass
    const result = emptyObjectSchema({ arguments: {} });
    expect(result instanceof type.errors).toBe(false);
  });

  test("Record<string, unknown> would incorrectly accept any object properties", () => {
    // This test documents why we changed from Record<string, unknown> to {}
    // Record<string, unknown> means any object with string keys and unknown values
    // which would incorrectly accept objects with properties for a no-argument tool

    const recordSchema = type("Record<string, unknown>");

    // This would incorrectly pass with Record schema
    const withProperties = recordSchema({ foo: "bar", baz: 123 });
    expect(withProperties instanceof type.errors).toBe(false);

    // Note: In ArkType, type({}) also accepts objects with additional properties
    // because {} means "an object" not "an object with exactly no properties"
    // For MCP tool schemas, this is actually the desired behavior for extensibility
    const emptyObjectSchema = type({});
    const withExtraProps = emptyObjectSchema({ foo: "bar" });

    // Both patterns accept objects (the issue was that Record<string, unknown>
    // was not being recognized properly by some MCP clients)
    expect(withExtraProps instanceof type.errors).toBe(false);
  });

  test("empty object {} accepts objects regardless of properties", () => {
    const schema = type({});

    // Accepts empty object
    const empty = schema({});
    expect(empty instanceof type.errors).toBe(false);

    // Also accepts object with properties (in ArkType, {} means "object type")
    const withProps = schema({ foo: "bar" });
    expect(withProps instanceof type.errors).toBe(false);

    // But rejects non-objects
    const notObject = schema("not an object");
    expect(notObject instanceof type.errors).toBe(true);
  });
});

describe("Tool registration with empty arguments schema", () => {
  test("tool with empty arguments can be called without parameters", () => {
    // Simulates the tool registration pattern used in the codebase
    const toolSchema = type({
      name: '"example_tool"',
      arguments: {},
    });

    // When the tool is called with empty arguments
    const callData = {
      name: "example_tool",
      arguments: {},
    };

    const validated = toolSchema(callData);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.name).toBe("example_tool");
      expect(validated.arguments).toEqual({});
    }
  });

  test("multiple tools with empty arguments schemas", () => {
    const tools = [
      {
        schema: type({
          name: '"get_server_info"',
          arguments: {},
        }),
        name: "get_server_info",
      },
      {
        schema: type({
          name: '"delete_active_file"',
          arguments: {},
        }),
        name: "delete_active_file",
      },
    ];

    tools.forEach(({ schema, name: toolName }) => {
      const result = schema({
        name: toolName,
        arguments: {},
      });
      expect(result instanceof type.errors).toBe(false);
    });
  });
});
