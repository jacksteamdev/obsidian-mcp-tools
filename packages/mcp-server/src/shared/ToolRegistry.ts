import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  ErrorCode,
  McpError,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { formatMcpError } from "./formatMcpError.js";
import { logger } from "./logger.js";

interface HandlerContext {
  server: McpServer;
}

/**
 * Ensure an MCP tool's `inputSchema` always carries an explicit
 * `properties` key (even when empty) and a well-formed
 * `additionalProperties` value. Some non-Claude MCP clients —
 * notably Letta Cloud and several OpenAI-compatible bridges — reject
 * tool schemas that omit `properties`, or that set
 * `additionalProperties: {}` (an empty-object schema, semantically
 * equivalent to `true` but not accepted by strict validators).
 *
 * This is defense in depth on top of the per-feature fix of using
 * empty-object literals instead of `Record<string, unknown>`: if a
 * future contributor reintroduces an open-record argument schema,
 * the wrapper still yields a well-formed output for strict clients.
 *
 * Exported so it can be unit-tested without instantiating the whole
 * ToolRegistry.
 *
 * See upstream issues #63 (Letta Cloud) and #77 (openai-codex).
 */
export function normalizeInputSchema(
  jsonSchema: unknown,
): Record<string, unknown> {
  // Accept any JSON-schema-shaped value; fall back to an empty object
  // schema if the input is somehow not an object (should not happen
  // with ArkType, but we refuse to crash on malformed data).
  const base =
    typeof jsonSchema === "object" && jsonSchema !== null
      ? (jsonSchema as Record<string, unknown>)
      : { type: "object" };

  // Clone to avoid mutating the caller's object.
  const result: Record<string, unknown> = { ...base };

  // Force-set `type: "object"` if missing — MCP inputSchema must be an
  // object type by protocol.
  if (!("type" in result)) {
    result.type = "object";
  }

  // Guarantee `properties` is present, defaulting to an empty object
  // for no-arg tools (upstream #77).
  if (!("properties" in result)) {
    result.properties = {};
  }

  // Strip `additionalProperties: {}` — an empty-object schema is
  // semantically equivalent to `additionalProperties: true` but is
  // rejected by strict validators such as Letta Cloud (upstream #63).
  // `true`, `false`, and genuine sub-schemas are left untouched.
  const ap = result.additionalProperties;
  if (
    ap !== undefined &&
    typeof ap === "object" &&
    ap !== null &&
    Object.keys(ap as Record<string, unknown>).length === 0
  ) {
    delete result.additionalProperties;
  }

  return result;
}

const textResult = type({
  type: '"text"',
  text: "string",
});
const imageResult = type({
  type: '"image"',
  data: "string.base64",
  mimeType: "string",
});
// Audio content block — added alongside image for MCP SDK 1.29.0's
// native audio support (used by `get_vault_file` to stream audio bytes
// without base64-ifying them into text). See issue #59.
const audioResult = type({
  type: '"audio"',
  data: "string.base64",
  mimeType: "string",
});
export const resultSchema = type({
  content: textResult.or(imageResult).or(audioResult).array(),
  "isError?": "boolean",
});

type ResultSchema = typeof resultSchema.infer;

/**
 * The ToolRegistry class represents a set of tools that can be used by
 * the server. It is a map of request schemas to request handlers
 * that provides a list of available tools and a method to handle requests.
 */
export class ToolRegistryClass<
  TSchema extends Type<{
    name: string;
    // `object` (not `Record<string, unknown>`) so that tools declaring
    // `arguments: {}` — i.e. no-arg tools — still type-check. See the
    // normalizeInputSchema helper below for why the empty-object form
    // is preferred over the open-record form.
    arguments?: object;
  }>,
  THandler extends (
    request: TSchema["infer"],
    context: HandlerContext,
  ) => Promise<Result>,
> extends Map<TSchema, THandler> {
  private enabled = new Set<TSchema>();

  register<
    Schema extends TSchema,
    Handler extends (
      request: Schema["infer"],
      context: HandlerContext,
    ) => ResultSchema | Promise<ResultSchema>,
  >(schema: Schema, handler: Handler) {
    if (this.has(schema)) {
      // @ts-expect-error We know the const property is present for a string
      const name = schema.get("name").toJsonSchema().const as string;
      throw new Error(`Tool already registered: ${name}`);
    }
    this.enable(schema);
    return super.set(
      schema as unknown as TSchema,
      handler as unknown as THandler,
    );
  }

  enable = <Schema extends TSchema>(schema: Schema) => {
    this.enabled.add(schema);
    return this;
  };

  disable = <Schema extends TSchema>(schema: Schema) => {
    this.enabled.delete(schema);
    return this;
  };

  /**
   * Disable a tool by its public name (the string used in MCP
   * `tools/list` / `tools/call`). Returns `true` if a matching tool
   * was found and disabled, `false` otherwise.
   *
   * Useful for applying user-controlled disable lists (e.g. from an
   * env var) after all features have registered their tools.
   */
  disableByName = (name: string): boolean => {
    for (const schema of this.keys()) {
      // @ts-expect-error We know the const property is present for a string
      const toolName = schema.get("name").toJsonSchema().const as string;
      if (toolName === name) {
        this.disable(schema);
        return true;
      }
    }
    return false;
  };

  list = () => {
    return {
      tools: Array.from(this.enabled.values()).map((schema) => {
        return {
          // @ts-expect-error We know the const property is present for a string
          name: schema.get("name").toJsonSchema().const,
          description: schema.description,
          inputSchema: normalizeInputSchema(
            schema.get("arguments").toJsonSchema(),
          ),
        };
      }),
    };
  };

  /**
   * MCP SDK sends boolean values as "true" or "false". This method coerces the boolean
   * values in the request parameters to the expected type.
   *
   * @param schema Arktype schema
   * @param params MCP request parameters
   * @returns MCP request parameters with corrected boolean values
   */
  private coerceBooleanParams = <Schema extends TSchema>(
    schema: Schema,
    params: Schema["infer"],
  ): Schema["infer"] => {
    // `arguments` is typed as `object` at the registry level (so that
    // no-arg tools can declare `arguments: {}`), but inside this method
    // we need index access, so we treat it as an open dictionary.
    const args = params.arguments as Record<string, unknown> | undefined;
    const argsSchema = schema.get("arguments").exclude("undefined");
    if (!args || !argsSchema) return params;

    const fixed: Record<string, unknown> = { ...args };
    for (const [key, value] of Object.entries(args)) {
      // ArkType's typed .get() no longer accepts arbitrary string keys
      // now that the registry constraint is `object` instead of
      // `Record<string, unknown>`. Cast the schema to a loose getter for
      // this lookup — the runtime behavior is identical.
      const valueSchema = (
        argsSchema as unknown as { get: (k: string) => { exclude: (s: string) => { expression: string } } }
      ).get(key).exclude("undefined");
      if (
        valueSchema.expression === "boolean" &&
        typeof value === "string" &&
        ["true", "false"].includes(value)
      ) {
        fixed[key] = value === "true";
      }
    }

    return { ...params, arguments: fixed };
  };

  dispatch = async <Schema extends TSchema>(
    params: Schema["infer"],
    context: HandlerContext,
  ) => {
    try {
      for (const [schema, handler] of this.entries()) {
        // Only dispatch to tools that are currently enabled. A disabled
        // tool must behave as if it did not exist — otherwise `list()`
        // and `dispatch()` would disagree and clients could invoke tools
        // the user explicitly turned off.
        if (!this.enabled.has(schema)) continue;
        if (schema.get("name").allows(params.name)) {
          const validParams = schema.assert(
            this.coerceBooleanParams(schema, params),
          );
          // return await to handle runtime errors here
          return await handler(validParams, context);
        }
      }
      throw new McpError(
        ErrorCode.InvalidRequest,
        `Unknown tool: ${params.name}`,
      );
    } catch (error) {
      const formattedError = formatMcpError(error);
      logger.error(`Error handling ${params.name}`, {
        ...formattedError,
        message: formattedError.message,
        stack: formattedError.stack,
        error,
        params,
      });
      throw formattedError;
    }
  };
}

export type ToolRegistry = ToolRegistryClass<
  Type<{
    name: string;
    // `object` (not `Record<string, unknown>`) so that tools declaring
    // `arguments: {}` — i.e. no-arg tools — still type-check. See the
    // normalizeInputSchema helper below for why the empty-object form
    // is preferred over the open-record form.
    arguments?: object;
  }>,
  (
    request: {
      name: string;
      // `object` (not `Record<string, unknown>`) so that tools declaring
      // `arguments: {}` — i.e. no-arg tools — still type-check. See the
      // normalizeInputSchema helper below for why the empty-object form
      // is preferred over the open-record form.
      arguments?: object;
    },
    context: HandlerContext,
  ) => Promise<Result>
>;
