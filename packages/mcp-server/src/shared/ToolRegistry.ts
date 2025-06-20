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
        try {
          // Get the name schema
          const nameSchema = schema.get("name");
          
          // Get the name as a string for special case handling
          let nameValue = "unknown";
          try {
            // @ts-expect-error We know the const property is present for a string
            nameValue = nameSchema.toJsonSchema().const;
          } catch (error) {
            logger.warn(`Failed to get name for tool schema`, { error });
          }
          
          // Special case for list_configured_vaults tool
          if (nameValue === "list_configured_vaults") {
            return {
              name: "list_configured_vaults",
              description: schema.description || "Lists all configured Obsidian vaults with their ID and name.",
              inputSchema: { type: "object", properties: {} },
            };
          }
          
          // For all other tools, try to get the arguments schema
          let inputSchema: any = { type: "object", properties: {} };
          try {
            const argsSchema = schema.get("arguments");
            if (argsSchema) {
              inputSchema = argsSchema.toJsonSchema();
            }
          } catch (error) {
            logger.warn(`Failed to convert arguments schema to JSON Schema for tool: ${nameValue}`, { error });
          }
          
          return {
            name: nameValue,
            description: schema.description || "",
            inputSchema,
          };
        } catch (error) {
          logger.error(`Failed to process schema for tool list`, { error });
          // Return a minimal valid tool definition to avoid breaking the list
          return {
            name: "unknown",
            description: "Error processing tool schema",
            inputSchema: { type: "object", properties: {} },
          };
        }
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
    // Get the arguments schema, handling the case where it might be undefined
    const argsSchemaRaw = schema.get("arguments");
    if (!args || !argsSchemaRaw) return params;
    
    const argsSchema = argsSchemaRaw.exclude("undefined");
    if (!argsSchema) return params;

    const fixed = { ...params.arguments };
    for (const [key, value] of Object.entries(args)) {
      try {
        const keySchema = argsSchema.get(key);
        if (!keySchema) continue;
        
        const valueSchema = keySchema.exclude("undefined");
        if (
          valueSchema.expression === "boolean" &&
          typeof value === "string" &&
          ["true", "false"].includes(value)
        ) {
          fixed[key] = value === "true";
        }
      } catch (error) {
        // Skip this key if there's an error accessing its schema
        continue;
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
