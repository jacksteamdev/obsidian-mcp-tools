import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ErrorCode,
  McpError,
  type Result,
} from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { formatMcpError } from "./formatMcpError.js";
import { logger } from "./logger.js";

interface HandlerContext {
  server: Server;
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
const resultSchema = type({
  content: textResult.or(imageResult).array(),
  "isError?": "boolean",
});

type ResultSchema = typeof resultSchema.infer;

/**
 * The ToolRegistry class represents a set of tools that can be used by
 * the server. It is a map of request schemas to request handlers
 * that provides a list of available tools and a method to handle requests.
 */
export class ToolRegistryClass<
  TSchema extends Type<
    {
      name: string;
      arguments?: Record<string, unknown>;
    },
    {}
  >,
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
      throw new Error(`Tool already registered: ${schema.get("name")}`);
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

  list = () => {
    return {
      tools: Array.from(this.enabled.values()).map((schema) => {
        return {
          // @ts-expect-error We know the const property is present for a string
          name: schema.get("name").toJsonSchema().const,
          description: schema.description,
          inputSchema: schema.get("arguments").toJsonSchema(),
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
    const args = params.arguments;
    const argsSchema = schema.get("arguments").exclude("undefined");
    if (!args || !argsSchema) return params;

    const fixed = { ...params.arguments };
    for (const [key, value] of Object.entries(args)) {
      const valueSchema = argsSchema.get(key).exclude("undefined");
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
  Type<
    {
      name: string;
      arguments?: Record<string, unknown>;
    },
    {}
  >,
  (
    request: {
      name: string;
      arguments?: Record<string, unknown>;
    },
    context: HandlerContext,
  ) => Promise<Result>
>;
