import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { logger } from "./logger";

function trimTrailingSlash(value: string): string {
  return value.replace(/\/$/, "");
}

interface BaseUrlEnv {
  OBSIDIAN_BASE_URL?: string;
  OBSIDIAN_HOST?: string;
  OBSIDIAN_HTTP_PORT?: string;
  OBSIDIAN_HTTPS_PORT?: string;
  OBSIDIAN_USE_HTTP?: string;
}

export function resolveBaseUrl(env: BaseUrlEnv = process.env): string {
  const baseUrl = env.OBSIDIAN_BASE_URL?.trim();
  if (baseUrl) {
    return trimTrailingSlash(baseUrl);
  }

  // Default to HTTPS, fallback to HTTP if specified. Custom ports allow
  // multiple Obsidian vaults to expose separate Local REST API instances.
  const useHttp = env.OBSIDIAN_USE_HTTP === "true";
  const protocol = useHttp ? "http" : "https";
  const host = env.OBSIDIAN_HOST || "127.0.0.1";
  const port = useHttp
    ? (env.OBSIDIAN_HTTP_PORT ?? "27123")
    : (env.OBSIDIAN_HTTPS_PORT ?? "27124");

  return `${protocol}://${host}:${port}`;
}

export const BASE_URL = resolveBaseUrl();

// Disable TLS certificate validation for local self-signed certificates
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
  });

  if (!response.ok) {
    const error = await response.text();
    const message = `${init?.method ?? "GET"} ${path} ${response.status}: ${error}`;
    throw new McpError(ErrorCode.InternalError, message);
  }

  const isJSON = !!response.headers.get("Content-Type")?.includes("json");
  const data = isJSON ? await response.json() : await response.text();
  // 204 No Content responses should be validated as undefined
  const validated = response.status === 204 ? undefined : schema(data);
  if (validated instanceof type.errors) {
    const stackError = new Error();
    Error.captureStackTrace(stackError, makeRequest);
    logger.error("Invalid response from Obsidian API", {
      status: response.status,
      error: validated.summary,
      stack: stackError.stack,
      data,
    });
    throw new McpError(
      ErrorCode.InternalError,
      `${init?.method ?? "GET"} ${path} ${response.status}: ${validated.summary}`,
    );
  }

  return validated;
}
