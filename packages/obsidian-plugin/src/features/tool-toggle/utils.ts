/**
 * Canonical list of MCP tool names exposed by this server. Hardcoded
 * here to avoid a runtime discovery call from the settings UI (the
 * server does not expose a "list of tool names" endpoint via Local
 * REST API — only via the stdio MCP protocol it speaks to clients).
 *
 * If the server adds or removes a tool, update this list to keep the
 * "Show available tool names" disclosure in the settings UI in sync.
 * The server is authoritative at runtime: unknown names in
 * OBSIDIAN_DISABLED_TOOLS are logged as warnings by
 * `packages/mcp-server/src/features/core/index.ts` and do not abort
 * startup, so a stale list degrades gracefully.
 */
export const KNOWN_MCP_TOOL_NAMES: readonly string[] = [
  // Vault file management (packages/mcp-server/src/features/local-rest-api)
  "get_server_info",
  "get_active_file",
  "update_active_file",
  "append_to_active_file",
  "patch_active_file",
  "delete_active_file",
  "show_file_in_obsidian",
  "list_vault_files",
  "get_vault_file",
  "create_vault_file",
  "append_to_vault_file",
  "patch_vault_file",
  "delete_vault_file",
  "search_vault",
  "search_vault_simple",
  // Semantic search (packages/mcp-server/src/features/smart-connections)
  "search_vault_smart",
  // Templater (packages/mcp-server/src/features/templates)
  "execute_template",
  // Web fetch (packages/mcp-server/src/features/fetch)
  "fetch",
] as const;

/**
 * Parse the comma-or-newline-separated list of tool names the user
 * types into the settings textarea. Whitespace around each entry is
 * trimmed and empty entries (from double commas, trailing commas, or
 * blank lines) are dropped. Duplicates are preserved so the user sees
 * exactly what they typed.
 *
 * Exported for unit testing.
 */
export function parseDisabledToolsCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Format a list of disabled tool names as the exact string expected
 * by the `OBSIDIAN_DISABLED_TOOLS` env var. Returns `undefined` when
 * the list would be empty so callers can omit the env var entirely
 * rather than writing `OBSIDIAN_DISABLED_TOOLS: ""` to the client
 * config file.
 *
 * Exported for unit testing.
 */
export function serializeDisabledToolsToEnv(
  disabled: readonly string[],
): string | undefined {
  const cleaned = disabled
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (cleaned.length === 0) return undefined;
  return cleaned.join(", ");
}
