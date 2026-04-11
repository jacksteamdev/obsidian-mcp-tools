import { logger } from "$/shared/logger";
import { type } from "arktype";
import type { Request, Response } from "express";
import type { App, Plugin } from "obsidian";
import { LocalRestAPI } from "shared";
import type { CommandAuditEntry } from "../types";
import {
  appendAuditEntry,
  createRuntimeRateCounter,
  decidePermission,
  isDestructiveCommand,
  SOFT_RATE_LIMIT_PER_MINUTE,
} from "../utils";
import {
  CommandPermissionModal,
  type ModalDecision,
} from "./commandPermissionModal";

/**
 * Express handler for `POST /mcp-tools/command-permission/`.
 *
 * Called by the MCP server every time the agent invokes
 * `execute_obsidian_command`. The handler has two paths:
 *
 * **Fast path (decideable from settings alone)**:
 *
 * 1. Validate the request body via `CommandPermissionRequest`.
 * 2. Load settings via `plugin.loadData()` to fetch `enabled` and
 *    `allowlist`.
 * 3. If the master toggle is OFF, deny immediately with a helpful
 *    reason. (Deny-by-default is the whole point of the feature.)
 * 4. If the command id is in the allowlist, allow immediately.
 *
 * **Slow path (modal confirmation — Fase 2)**:
 *
 * 5. If the master toggle is ON and the command id is NOT in the
 *    allowlist, invoke the `CommandPermissionModal` in the Obsidian
 *    UI and long-poll the HTTP response until the user clicks a
 *    button or 30 seconds elapse. The handler maps the modal
 *    decision to an HTTP response like this:
 *
 *       allow-once    → { decision: "allow" }, no state change
 *       allow-always  → { decision: "allow" }, commandId appended
 *                        to settings.commandPermissions.allowlist
 *       deny          → { decision: "deny", reason: "… by user" }
 *       timeout       → { decision: "deny", reason: "… in 30s" }
 *
 * Both paths append an audit entry to the ring buffer and persist
 * the updated settings. The audit entry includes a `reason` field
 * only for denied decisions (allow entries are intentionally tidy).
 *
 * The handler is bound into main.ts via `this.localRestApi.api
 * .addRoute("/mcp-tools/command-permission/").post(...)`, same
 * pattern already used for `/search/smart` and `/templates/execute`.
 *
 * Error handling: any unexpected failure (bad body, settings load
 * fail, save fail, modal crash) returns 500 with a generic message
 * unless the response stream was already closed (long-polling +
 * client disconnect), in which case the error is logged and
 * swallowed. The MCP server will interpret a non-2xx as a failure
 * to validate and raise an MCPError upstream.
 */

/**
 * Hard upper bound on how long the handler will hold the HTTP
 * response open while waiting for the user to click a button. 30s
 * matches the design document; it is short enough that most MCP
 * clients will not time out the tool call (Claude Desktop's default
 * is much larger) and long enough that a distracted user can notice
 * the modal.
 */
const MODAL_TIMEOUT_MS = 30_000;

/**
 * Plugin-side rolling counter used for the Fase 2 soft rate-limit
 * warning. Lives at module scope so it persists across handler
 * invocations for the lifetime of the plugin (it resets on plugin
 * reload, which is the design intent).
 *
 * NOT enforcement — the server-side rate limiter in
 * `packages/mcp-server/src/features/commands/services/rateLimit.ts`
 * still drops calls above 100/min hard. This counter exists only
 * so the modal can flag calls above 30/min with a visible nudge.
 */
const runtimeRateCounter = createRuntimeRateCounter();

/**
 * Discriminated union returned by the modal-awaiting helper. The
 * `decided` case carries the user's button click; the `timeout`
 * case means the 30-second fallback fired first.
 */
type ModalOutcome =
  | { kind: "decided"; decision: ModalDecision }
  | { kind: "timeout" };

/**
 * Obsidian's `App.commands` is not in the public `obsidian.d.ts`
 * surface, but it is present at runtime as
 * `app.commands.commands[id]?.name`. We cast narrowly so the call
 * stays type-safe and the compiler does not complain.
 */
function resolveCommandName(
  app: App,
  commandId: string,
): string | undefined {
  const registry = (
    app as unknown as {
      commands?: {
        commands?: Record<string, { id: string; name: string }>;
      };
    }
  ).commands?.commands;
  return registry?.[commandId]?.name;
}

/**
 * Race the modal decision against the timeout. On timeout we close
 * the modal explicitly so its `onClose` hook runs and Svelte is
 * unmounted; otherwise the modal would remain on-screen indefinitely
 * after the HTTP response has been sent.
 */
async function awaitModalDecision(
  modal: CommandPermissionModal,
): Promise<ModalOutcome> {
  const decisionPromise = modal
    .waitForDecision()
    .then((decision): ModalOutcome => ({ kind: "decided", decision }));

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<ModalOutcome>((resolve) => {
    timeoutHandle = setTimeout(
      () => resolve({ kind: "timeout" }),
      MODAL_TIMEOUT_MS,
    );
  });

  try {
    const outcome = await Promise.race([decisionPromise, timeoutPromise]);
    if (outcome.kind === "timeout") {
      modal.close();
    }
    return outcome;
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/**
 * Safely write a JSON response. Long-polling with a 30s window gives
 * the client plenty of opportunity to abort (close the socket, time
 * out its own request, etc). Writing to a closed Node response throws
 * `ERR_STREAM_WRITE_AFTER_END`; we catch it and log rather than
 * letting it propagate to the express error-handling middleware.
 */
function safeJson(
  res: Response,
  body: unknown,
  logContext: Record<string, unknown>,
): void {
  try {
    if (!res.writableEnded) {
      res.json(body);
    } else {
      logger.debug(
        "Response stream already ended before we could reply",
        logContext,
      );
    }
  } catch (error) {
    logger.warn("Failed to write command permission response", {
      ...logContext,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

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
      safeJson(
        res.status(400),
        { error: "Invalid request body", summary: parsed.summary },
        { stage: "validation" },
      );
      return;
    }

    // 2. Load settings. We re-read on every call because the user
    //    may have updated the allowlist or the enable toggle between
    //    invocations; caching would introduce staleness bugs.
    const settings = (await plugin.loadData()) ?? {};
    const perms = settings.commandPermissions ?? {};

    // 3. Fast-path decision (master off or command already in list).
    const pureOutcome = decidePermission(
      parsed.commandId,
      perms.enabled,
      perms.allowlist,
    );

    // Record the call in the runtime rate counter regardless of
    // which path we take. The soft-rate warning should reflect
    // total volume, not just modal invocations.
    runtimeRateCounter.record();

    let finalDecision: "allow" | "deny" = pureOutcome.decision;
    let finalReason: string | undefined = pureOutcome.reason;
    let updatedAllowlist: string[] | undefined;

    // 4. Slow-path: the command is not in the allowlist AND the
    //    master toggle is ON. This is the branch that opens a modal
    //    and long-polls until the user answers.
    const needsModal =
      perms.enabled === true &&
      pureOutcome.decision === "deny" &&
      !(perms.allowlist ?? []).includes(parsed.commandId);

    if (needsModal) {
      const commandName = resolveCommandName(plugin.app, parsed.commandId);
      const isDestructive = isDestructiveCommand(
        parsed.commandId,
        commandName,
      );
      const rateCount = runtimeRateCounter.countInLastMinute();
      const showRateWarning = rateCount > SOFT_RATE_LIMIT_PER_MINUTE;

      logger.debug("Opening command permission modal", {
        commandId: parsed.commandId,
        commandName,
        isDestructive,
        rateCount,
        showRateWarning,
      });

      const modal = new CommandPermissionModal(plugin.app, {
        commandId: parsed.commandId,
        commandName,
        isDestructive,
        showRateWarning,
        rateCount,
      });
      modal.open();

      const outcome = await awaitModalDecision(modal);

      if (outcome.kind === "timeout") {
        finalDecision = "deny";
        finalReason = `User did not respond to the permission request for '${parsed.commandId}' within ${MODAL_TIMEOUT_MS / 1000} seconds.`;
      } else {
        const d = outcome.decision;
        if (d === "deny") {
          finalDecision = "deny";
          finalReason = `User denied permission for command '${parsed.commandId}' via the confirmation modal.`;
        } else {
          // "allow-once" and "allow-always" both authorize this
          // specific call. They differ only in whether the
          // decision is persisted for future invocations.
          finalDecision = "allow";
          finalReason = undefined;

          if (d === "allow-always") {
            const existing = perms.allowlist ?? [];
            if (!existing.includes(parsed.commandId)) {
              updatedAllowlist = [...existing, parsed.commandId];
            }
          }
        }
      }
    }

    // 5. Build the audit entry. The `reason` field is present only
    //    for denied decisions; allow entries stay tidy.
    const auditEntry: CommandAuditEntry = {
      timestamp: new Date().toISOString(),
      commandId: parsed.commandId,
      decision: finalDecision,
      ...(finalReason ? { reason: finalReason } : {}),
    };

    // 6. Persist: audit log + updated allowlist (if allow-always
    //    added an entry). The spread must happen in this order so
    //    that `updatedAllowlist` wins when present.
    const updatedRecent = appendAuditEntry(
      perms.recentInvocations,
      auditEntry,
    );
    settings.commandPermissions = {
      ...perms,
      ...(updatedAllowlist !== undefined
        ? { allowlist: updatedAllowlist }
        : {}),
      recentInvocations: updatedRecent,
    };
    await plugin.saveData(settings);

    // 7. Logger mirror — structured so a future log tool can filter.
    if (finalDecision === "allow") {
      logger.info("Command permission allowed", {
        commandId: parsed.commandId,
        persisted: updatedAllowlist !== undefined,
      });
    } else {
      logger.warn("Command permission denied", {
        commandId: parsed.commandId,
        reason: finalReason,
      });
    }

    // 8. Respond with the decision. `safeJson` guards against a
    //    client that disconnected during the long-poll.
    const responseBody: { decision: "allow" | "deny"; reason?: string } = {
      decision: finalDecision,
      ...(finalReason ? { reason: finalReason } : {}),
    };
    safeJson(res, responseBody, {
      commandId: parsed.commandId,
      decision: finalDecision,
    });
  } catch (error) {
    logger.error("Command permission handler error", {
      error: error instanceof Error ? error.message : String(error),
    });
    safeJson(
      res.status(500),
      { error: "Internal error while checking command permission" },
      { stage: "catchall" },
    );
  }
}
