import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";
import { type, type Type } from "arktype";
import { logger } from "./logger";
// We need getVaultConfig, but it's not exported from configManager.ts yet.
// For now, assume ObsidianMcpServer instance will provide it or be passed around.
// This will be resolved when ObsidianMcpServer is updated.
// import { getVaultConfig } from "./configManager"; // This will be used later

// Remove global BASE_URL and API_KEY logic, as it's now per-vault.

// Disable TLS certificate validation for local self-signed certificates
// This should ideally be configurable per vault if needed, or handled carefully.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/**
 * Makes a request to a specific Obsidian vault's Local REST API.
 * Retrieves vault-specific connection details (API key, base URL) using the vaultId.
 * If no vaultId is provided, it will use the default vault or first available vault.
 * Throws an `McpError` if the API response is not successful.
 *
 * @param vaultId - The ID of the target vault (must match an ID in vaults.json). If not provided, uses default or first vault.
 * @param schema - The ArkType schema to validate the response.
 * @param path - The path to the Obsidian API endpoint (e.g., "/active/").
 * @param vaultConfigProvider - Function that provides vault configuration details.
 * @param init - Optional request options to pass to the `fetch` function.
 * @returns The validated response from the Obsidian API.
 */
export async function makeRequest<
  T extends
    | Type<{}, {}>
    | Type<null | undefined, {}>
    | Type<{} | null | undefined, {}>,
>(
  vaultId: string | undefined, // Optional vaultId parameter
  schema: T,
  path: string,
  // vaultConfigProvider is required, so it comes before optional 'init'
  vaultConfigProvider: (id?: string) => { apiKey: string; localRestApiBaseUrl: string },
  init?: RequestInit,
): Promise<T["infer"]> {
  let vaultDetails;
  let actualVaultId: string;
  
  try {
    // Get the vault details
    vaultDetails = vaultConfigProvider(vaultId);
    
    // If vaultId was not provided, we can't determine the actual ID from just the connection details
    if (!vaultId) {
      actualVaultId = "default"; // We don't know the actual ID if default was used
      logger.debug("Using default vault");
    } else {
      actualVaultId = vaultId;
    }
  } catch (error: any) {
    // Catch errors from vaultConfigProvider (e.g., vaultId not found)
    logger.error(`Failed to get configuration for vaultId "${vaultId || 'default'}"`, { error: error.message });
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InvalidRequest, `Configuration error for vaultId "${vaultId || 'default'}": ${error.message}`);
  }

  const { apiKey: API_KEY, localRestApiBaseUrl: BASE_URL } = vaultDetails;

  // API_KEY and BASE_URL are guaranteed by VaultConfigEntrySchema to be non-empty strings
  // and localRestApiBaseUrl is a valid URL string.

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${API_KEY}`, // Use vault-specific API_KEY
      "Content-Type": "text/markdown", // Default, can be overridden by init.headers
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

  // Add the vault ID to the response if it's an object
  if (typeof validated === 'object' && validated !== null) {
    // We can't directly modify the validated object due to type constraints,
    // but we can log the vault ID for debugging
    logger.debug(`Request to ${path} used vault: ${actualVaultId}`);
  }
  
  return validated;
}
