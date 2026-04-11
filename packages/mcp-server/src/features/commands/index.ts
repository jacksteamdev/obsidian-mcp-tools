import { makeRequest, type ToolRegistry } from "$/shared";
import {
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { type } from "arktype";
import { LocalRestAPI } from "shared";
import { defaultCommandRateLimiter } from "./services/rateLimit";

/**
 * Register the two command-execution tools on the shared ToolRegistry.
 *
 * This is MVP / Fase 1 from docs/design/issue-29-command-execution.md:
 * - `list_obsidian_commands` is read-only and always available.
 * - `execute_obsidian_command` is gated by the plugin's permission
 *   check (`POST /mcp-tools/command-permission/`) which enforces the
 *   user's master enable toggle and allowlist.
 * - Rate limit: 100 execute calls per rolling minute (tumbling window),
 *   per-process, in-memory. The list tool is intentionally not rate
 *   limited.
 * - No confirmation modal in Fase 1 — if a command is not in the
 *   allowlist, the plugin simply returns `{ decision: "deny" }` and
 *   the server raises an MCP error. Fase 2 will add the long-polling
 *   modal flow.
 *
 * Both tools are registered unconditionally. The master enable toggle
 * lives in the plugin and is checked on every call — disabling it
 * turns `execute_obsidian_command` into a pure error source, but the
 * tool schema is still advertised to the client. This is a deliberate
 * simplification from the original design (which proposed two separate
 * leverages, master-enable + killswitch); one leve keeps the UX and
 * config surface smaller while preserving the security story.
 */
export function registerCommandsTools(tools: ToolRegistry) {
  // Read-only discovery tool. Always safe, no policy gate.
  tools.register(
    type({
      name: '"list_obsidian_commands"',
      arguments: {
        "query?": type("string").describe(
          "Optional case-insensitive substring filter applied to both command IDs and their human names. Omit to list everything.",
        ),
      },
    }).describe(
      "List the Obsidian commands available in the current vault. The list is dynamic: it depends on which Obsidian plugins are installed and which hotkeys the user has defined. Call this tool first to discover available commands before calling execute_obsidian_command.",
    ),
    async ({ arguments: args }) => {
      const data = await makeRequest(
        LocalRestAPI.ApiCommandsResponse,
        "/commands/",
      );

      const query = args.query?.toLowerCase();
      const filtered = query
        ? data.commands.filter(
            (c) =>
              c.id.toLowerCase().includes(query) ||
              c.name.toLowerCase().includes(query),
          )
        : data.commands;

      return {
        content: [
          { type: "text", text: JSON.stringify(filtered, null, 2) },
        ],
      };
    },
  );

  // Gated execution tool. Always goes through rate limit + plugin
  // permission check.
  tools.register(
    type({
      name: '"execute_obsidian_command"',
      arguments: {
        commandId: type("string>0").describe(
          "The Obsidian command id to execute, e.g. `editor:toggle-bold`. The user must have pre-authorized this command in the plugin's 'Command execution' settings — if the id is not in their allowlist, this call returns a permission-denied error. Use list_obsidian_commands first to discover what commands exist in the current vault.",
        ),
      },
    }).describe(
      "Execute an Obsidian command by id. Commands are plugin-provided and vary between vaults — always call list_obsidian_commands first to discover what is available. Command execution requires explicit user authorization via the plugin's settings UI ('Enable MCP command execution' toggle plus a per-command allowlist). Unauthorized calls return a permission-denied error without executing anything. Subject to a rate limit (100 executions per minute).",
    ),
    async ({ arguments: args }) => {
      // 1. Rate limit first — cheap check, protects the plugin from
      //    being flooded. No roundtrip until we know we're allowed
      //    to consume a slot.
      if (!defaultCommandRateLimiter()) {
        throw new McpError(
          ErrorCode.InvalidRequest,
          "Rate limit exceeded: too many command executions in the last minute. Wait a bit and try again.",
        );
      }

      // 2. Ask the plugin whether this command is permitted.
      //    The plugin enforces the master toggle + allowlist.
      const permission = await makeRequest(
        LocalRestAPI.CommandPermissionResponse,
        "/mcp-tools/command-permission/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandId: args.commandId }),
        },
      );

      if (permission.decision !== "allow") {
        throw new McpError(
          ErrorCode.InvalidRequest,
          permission.reason ??
            `User has not authorized command '${args.commandId}'`,
        );
      }

      // 3. Execute via Local REST API. 204 No Content on success.
      await makeRequest(
        LocalRestAPI.ApiNoContentResponse,
        `/commands/${encodeURIComponent(args.commandId)}/`,
        { method: "POST" },
      );

      return {
        content: [
          {
            type: "text",
            text: `Executed Obsidian command '${args.commandId}'.`,
          },
        ],
      };
    },
  );
}
