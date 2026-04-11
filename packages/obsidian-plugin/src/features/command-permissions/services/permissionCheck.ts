import { logger } from "$/shared/logger";
import { type } from "arktype";
import type { Request, Response } from "express";
import type { Plugin } from "obsidian";
import { LocalRestAPI } from "shared";
import type { CommandAuditEntry } from "../types";
import { appendAuditEntry, decidePermission } from "../utils";

/**
 * Express handler for `POST /mcp-tools/command-permission/`.
 *
 * Called by the MCP server every time the agent invokes
 * `execute_obsidian_command`. The handler:
 *
 * 1. Validates the request body via the shared CommandPermissionRequest
 *    schema (must contain a non-empty `commandId`).
 * 2. Reads the user's settings via `plugin.loadData()` to fetch the
 *    current `commandPermissions.enabled` flag and `allowlist`.
 * 3. Uses `decidePermission()` (pure) to compute the outcome.
 * 4. Appends an audit entry to the ring buffer in settings and
 *    persists the updated settings back via `plugin.saveData()`.
 * 5. Also mirrors the outcome to the plugin logger for long-term
 *    analysis (e.g. debugging, support).
 * 6. Returns the JSON decision to the caller.
 *
 * The handler is bound into main.ts via `this.localRestApi.api
 * .addRoute("/mcp-tools/command-permission/").post(...)`, same
 * pattern already used for `/search/smart` and `/templates/execute`.
 *
 * Error handling: any unexpected failure (bad body, settings load
 * fail, save fail) returns 500 with a generic message. The MCP server
 * will interpret the non-2xx as a failure to validate and raise an
 * MCPError upstream.
 */
export async function handleCommandPermissionRequest(
  plugin: Plugin,
  req: Request,
  res: Response,
): Promise<void> {
  try {
    // 1. Validate the incoming body.
    const parsed = LocalRestAPI.CommandPermissionRequest(req.body);
    if (parsed instanceof type.errors) {
      logger.debug("Invalid command permission request body", {
        body: req.body,
        summary: parsed.summary,
      });
      res.status(400).json({
        error: "Invalid request body",
        summary: parsed.summary,
      });
      return;
    }

    // 2. Load settings. We re-read on every call because the user may
    //    have updated the allowlist or the enable toggle between
    //    invocations; caching would introduce staleness bugs.
    const settings = (await plugin.loadData()) ?? {};
    const perms = settings.commandPermissions ?? {};

    // 3. Decide.
    const outcome = decidePermission(
      parsed.commandId,
      perms.enabled,
      perms.allowlist,
    );

    // 4. Append to the audit ring buffer. This must not mutate the
    //    existing settings object in place — we rebuild and save.
    const auditEntry: CommandAuditEntry = {
      timestamp: new Date().toISOString(),
      commandId: parsed.commandId,
      decision: outcome.decision,
      ...(outcome.reason ? { reason: outcome.reason } : {}),
    };
    const updatedRecent = appendAuditEntry(perms.recentInvocations, auditEntry);
    settings.commandPermissions = {
      ...perms,
      recentInvocations: updatedRecent,
    };
    await plugin.saveData(settings);

    // 5. Logger mirror — structured so a future log tool can filter.
    if (outcome.decision === "allow") {
      logger.info("Command permission allowed", {
        commandId: parsed.commandId,
      });
    } else {
      logger.warn("Command permission denied", {
        commandId: parsed.commandId,
        reason: outcome.reason,
      });
    }

    // 6. Respond with the decision.
    res.json(outcome);
  } catch (error) {
    logger.error("Command permission handler error", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      error: "Internal error while checking command permission",
    });
  }
}
