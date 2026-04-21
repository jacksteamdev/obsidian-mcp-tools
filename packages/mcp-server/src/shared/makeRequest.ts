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

/**
 * Collapse runs of consecutive forward slashes in a request path to a
 * single slash. Works around upstream issue #37: a caller-supplied
 * directory name with a trailing slash (e.g. "DevOps/") combined with
 * a hard-coded `/vault/` prefix produces `/vault/DevOps//`, which the
 * Obsidian Local REST API rejects with 404.
 *
 * Only operates on the path portion. The protocol separator in
 * BASE_URL (`https://`) is handled by the caller and never passes
 * through this function.
 *
 * Exported for unit testing.
 */
export function normalizePath(path: string): string {
  return path.replace(/\/{2,}/g, "/");
}

export interface ApiUrlParts {
  host?: string;
  port?: number;
  useHttp?: boolean;
}

/**
 * Parse a full `OBSIDIAN_API_URL` value (e.g. `https://10.0.0.1:27124`)
 * into its host/port/protocol parts. Kept as a best-effort: returns
 * `undefined` if the input is missing or malformed, or if the protocol
 * is not `http`/`https`. Callers layer the result under the more
 * specific `OBSIDIAN_HOST` / `OBSIDIAN_PORT` / `OBSIDIAN_USE_HTTP`
 * overrides. Exported for unit testing.
 */
export function parseApiUrl(raw: string | undefined): ApiUrlParts | undefined {
  if (!raw) return undefined;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    const host = url.hostname || undefined;
    const port = url.port ? parsePort(url.port) : undefined;
    return { host, port, useHttp: url.protocol === "http:" };
  } catch {
    return undefined;
  }
}

// Resolution precedence (most specific wins):
// - Port:     --port CLI flag > OBSIDIAN_PORT > OBSIDIAN_API_URL port > default
// - Host:     OBSIDIAN_HOST > OBSIDIAN_API_URL host > 127.0.0.1
// - Protocol: OBSIDIAN_USE_HTTP (if set) > OBSIDIAN_API_URL protocol > https
// OBSIDIAN_API_URL is a convenience alias: it only fills slots that
// the more specific variables leave empty. This keeps drop-in
// compatibility with upstream v0.2.x configurations (issue #66) without
// breaking anyone who already uses the granular env vars.
const API_URL_PARTS = parseApiUrl(process.env.OBSIDIAN_API_URL);
const USE_HTTP_ENV = process.env.OBSIDIAN_USE_HTTP;
const USE_HTTP =
  USE_HTTP_ENV != null && USE_HTTP_ENV !== ""
    ? USE_HTTP_ENV === "true"
    : (API_URL_PARTS?.useHttp ?? false);
const PROTOCOL = USE_HTTP ? "http" : "https";
const DEFAULT_PORT = USE_HTTP ? 27123 : 27124;
const ARG_PORT = resolvePortFromArgs(process.argv);
const ENV_PORT = parsePort(process.env.OBSIDIAN_PORT);
const PORT = ARG_PORT ?? ENV_PORT ?? API_URL_PARTS?.port ?? DEFAULT_PORT;
const HOST = process.env.OBSIDIAN_HOST || API_URL_PARTS?.host || "127.0.0.1";
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

  const safePath = normalizePath(path);
  const url = `${BASE_URL}${safePath}`;
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
    const message = `${init?.method ?? "GET"} ${safePath} ${response.status}: ${error}`;
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
      `${init?.method ?? "GET"} ${safePath} ${response.status}: ${validated.summary}`,
    );
  }

  return validated;
}

export interface BinaryResponse {
  bytes: Uint8Array;
  mimeType: string | null;
}

/**
 * Like `makeRequest`, but returns the raw response bytes instead of
 * decoding the body as text or JSON. Used by `get_vault_file` for
 * audio/image files that the MCP SDK 1.29.0 can carry natively via
 * `image`/`audio` content blocks.
 *
 * Callers are responsible for size-gating before calling — a multi-
 * hundred-megabyte download still allocates the full buffer here. The
 * MCP tool handler should check the `Content-Length` header via a HEAD
 * or pre-flight if it needs to guard against oversize payloads.
 */
export async function makeBinaryRequest(
  path: string,
  init?: RequestInit,
): Promise<BinaryResponse> {
  const API_KEY = process.env.OBSIDIAN_API_KEY;
  if (!API_KEY) {
    logger.error("OBSIDIAN_API_KEY environment variable is required", {
      env: process.env,
    });
    throw new Error("OBSIDIAN_API_KEY environment variable is required");
  }

  const safePath = normalizePath(path);
  const url = `${BASE_URL}${safePath}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    const message = `${init?.method ?? "GET"} ${safePath} ${response.status}: ${error}`;
    throw new McpError(ErrorCode.InternalError, message);
  }

  const buffer = await response.arrayBuffer();
  return {
    bytes: new Uint8Array(buffer),
    mimeType: response.headers.get("Content-Type"),
  };
}
