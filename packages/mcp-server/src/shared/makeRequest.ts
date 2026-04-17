import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { logger } from "./logger";

/**
 * Parse a port string into a valid TCP port number.
 * Returns `undefined` if the input is missing, non-numeric, or out of range.
 * Exported for unit testing.
 */
export function parsePort(raw: string | undefined): number | undefined {
  if (!raw || !/^\d+$/.test(raw)) return undefined;
  const port = Number(raw);
  return Number.isInteger(port) && port >= 1 && port <= 65535
    ? port
    : undefined;
}

/**
 * Extract a port override from argv, supporting both `--port 9000` and
 * `--port=9000` forms. Returns the first valid form found, or `undefined`.
 * Exported for unit testing.
 */
export function resolvePortFromArgs(argv: string[]): number | undefined {
  const equalsForm = argv.find((arg) => arg.startsWith("--port="));
  if (equalsForm) {
    return parsePort(equalsForm.split("=")[1]);
  }

  const flagIndex = argv.findIndex((arg) => arg === "--port");
  if (flagIndex >= 0) {
    return parsePort(argv[flagIndex + 1]);
  }

  return undefined;
}

// Port resolution precedence (Unix-style): --port CLI flag takes top
// priority, then OBSIDIAN_PORT env var, then the protocol default
// (27124 HTTPS / 27123 HTTP). Host is still controlled separately by
// OBSIDIAN_HOST for backward compatibility with the v0.2.26 setup.
const USE_HTTP = process.env.OBSIDIAN_USE_HTTP === "true";
const PROTOCOL = USE_HTTP ? "http" : "https";
const DEFAULT_PORT = USE_HTTP ? 27123 : 27124;
const ARG_PORT = resolvePortFromArgs(process.argv);
const ENV_PORT = parsePort(process.env.OBSIDIAN_PORT);
const PORT = ARG_PORT ?? ENV_PORT ?? DEFAULT_PORT;
const HOST = process.env.OBSIDIAN_HOST || "127.0.0.1";
export const BASE_URL = `${PROTOCOL}://${HOST}:${PORT}`;

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

export async function makeRequest<T extends Type>(
  schema: T,
  path: string,
  init?: RequestInit,
): Promise<T["infer"]> {
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
