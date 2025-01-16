import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { logger } from "./logger";

declare global {
  interface RequestInit {
    /** This is a Bun-specific feature and not available in the NodeJS runtime */
    tls?: {
      rejectUnauthorized: boolean;
    };
  }
}

// Default to HTTPS port, fallback to HTTP if specified
const USE_HTTP = process.env.OBSIDIAN_USE_HTTP === "true";
const PORT = USE_HTTP ? 27123 : 27124;
const PROTOCOL = USE_HTTP ? "http" : "https";
export const BASE_URL = `${PROTOCOL}://127.0.0.1:${PORT}`;

/**
 * Makes a request to the Obsidian Local REST API with the provided path and optional request options.
 * Automatically adds the required API key to the request headers.
 * Throws an `McpError` if the API response is not successful.
 *
 * @param path - The path to the Obsidian API endpoint.
 * @param init - Optional request options to pass to the `fetch` function.
 * @returns The response from the Obsidian API.
 */

export async function makeRequest<
  T extends
    | Type<{}, {}>
    | Type<null | undefined, {}>
    | Type<{} | null | undefined, {}>,
>(schema: T, path: string, init?: RequestInit): Promise<T["infer"]> {
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) {
    logger.error("OBSIDIAN_API_KEY environment variable is required", {
      env: process.env,
    });
    throw new Error("OBSIDIAN_API_KEY environment variable is required");
  }

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "text/markdown",
      ...init?.headers,
    },
    tls: {
      rejectUnauthorized: false,
      ...init?.tls,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected response from "${path}": ${error}`,
      {
        method: init?.method ?? "GET",
        status: response.status,
        data: error,
      },
    );
  }

  const isJSON = !!response.headers.get("Content-Type")?.includes("json");
  const data = isJSON ? await response.json() : await response.text();
  // 204 No Content responses should be validated as undefined
  const validated = response.status === 204 ? undefined : schema(data);
  if (validated instanceof type.errors) {
    const stackError = new Error();
    Error.captureStackTrace(stackError, makeRequest);
    logger.error(`Status ${response.status} from ${path}`, {
      status: response.status,
      error: validated.summary,
      stack: stackError.stack,
      data,
    });
    throw new McpError(
      ErrorCode.InternalError,
      `Unexpected response from "${path}": ${validated.summary}`,
      {
        method: init?.method ?? "GET",
        status: response.status,
        data,
      },
    );
  }

  return validated;
}
