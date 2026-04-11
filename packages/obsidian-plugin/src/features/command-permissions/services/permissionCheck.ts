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
import { createMutex } from "./settingsLock";

/**
 * Express handler for `POST /mcp-tools/command-permission/`.
 *
 * Called by the MCP server every time the agent invokes
 * `execute_obsidian_command`. The handler has two paths:
 *
 * **Fast path (decideable from settings alone)**:
 *
 * 1. Validate the request body via `CommandPermissionRequest`.
 * 2. Under the settings mutex: load settings, check the master
 *    toggle and allowlist, write the audit entry, save.
 * 3. Respond with the decision.
 *
 * **Slow path (modal confirmation — Fase 2)**:
 *
 * 4. Phase A decides the command needs a modal (master on, not in
 *    allowlist) and exits the lock WITHOUT writing any audit entry.
 * 5. Modal opens in Obsidian UI, handler awaits user decision.
 *    This wait happens OUTSIDE the lock so concurrent modal flows
 *    do not block each other.
 * 6. Phase B re-enters the lock, re-reads settings (in case the
 *    allowlist changed while the modal was open), writes the
 *    final audit entry, optionally appends to the allowlist if the
 *    user clicked "Allow always", saves.
 * 7. Respond.
 *
 * The handler maps the modal decision to the HTTP response like this:
 *
 *     allow-once    → { decision: "allow" }, no state change
 *     allow-always  → { decision: "allow" }, commandId appended
 *                      to settings.commandPermissions.allowlist
 *     deny          → { decision: "deny", reason: "… by user" }
 *     timeout       → { decision: "deny", reason: "… in 30s" }
 *
 * ## Why a mutex?
 *
 * `plugin.loadData()` and `plugin.saveData()` are independently
 * async, so concurrent handler invocations can race: each reads the
 * same "before" state, appends its audit entry to a copy, writes
 * back — and only the last writer's version survives. The original
 * Fase 1 handler had this race; Fase 2's soft rate-limit smoke test
 * (35 parallel fast-path calls) exposed it by dropping 32 of 35
 * audit entries. The mutex serializes the critical section without
 * affecting the modal wait (which stays outside the lock so multiple
 * modals can coexist).
 *
 * ## Error handling
 *
 * Any unexpected failure (bad body, settings load fail, save fail,
 * modal crash) returns 500 with a generic message unless the response
 * stream was already closed (long-polling + client disconnect), in
 * which case `safeJson` logs and swallows the error. The MCP server
 * will interpret a non-2xx as a failure to validate and raise an
 * MCPError upstream.
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
 * Serializes all settings-touching critical sections. See
 * `settingsLock.ts` for the design rationale. The mutex lives at
 * module scope so every handler invocation goes through the same
 * queue — two concurrent curl requests correctly interleave one at
 * a time through their load/modify/save cycles.
 */
const settingsMutex = createMutex();

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

/**
 * Result of the first lock phase. Either the decision is finalized
 * (fast path — no modal needed, audit already written) or the handler
 * must proceed to open a modal and run phase B afterward.
 */
type PhaseAResult =
  | { kind: "done"; decision: "allow" | "deny"; reason?: string }
  | { kind: "needs-modal" };

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

    // Record the call in the runtime rate counter regardless of
    // which path we take. Pure in-memory operation, no lock needed
    // (JavaScript is single-threaded and the counter ops are sync).
    runtimeRateCounter.record();

    // 2. Phase A — decide the pure outcome under the settings lock.
    //    If the fast path applies (master off, or command already
    //    in allowlist), we write the audit entry and save here.
    //    Otherwise we return `needs-modal` and exit the lock so
    //    the modal flow can run without blocking other requests.
    const phaseA: PhaseAResult = await settingsMutex.run(async () => {
      const settings = (await plugin.loadData()) ?? {};
      const perms = settings.commandPermissions ?? {};

      const pureOutcome = decidePermission(
        parsed.commandId,
        perms.enabled,
        perms.allowlist,
      );

      const inAllowlist = (perms.allowlist ?? []).includes(parsed.commandId);
      const needsModal =
        perms.enabled === true &&
        pureOutcome.decision === "deny" &&
        !inAllowlist;

      if (needsModal) {
        return { kind: "needs-modal" };
      }

      // Fast path: write audit + save.
      const auditEntry: CommandAuditEntry = {
        timestamp: new Date().toISOString(),
        commandId: parsed.commandId,
        decision: pureOutcome.decision,
        ...(pureOutcome.reason ? { reason: pureOutcome.reason } : {}),
      };
      const updatedRecent = appendAuditEntry(
        perms.recentInvocations,
        auditEntry,
      );
      settings.commandPermissions = {
        ...perms,
        recentInvocations: updatedRecent,
      };
      await plugin.saveData(settings);

      return {
        kind: "done",
        decision: pureOutcome.decision,
        reason: pureOutcome.reason,
      };
    });

    if (phaseA.kind === "done") {
      if (phaseA.decision === "allow") {
        logger.info("Command permission allowed", {
          commandId: parsed.commandId,
          persisted: false,
        });
      } else {
        logger.warn("Command permission denied", {
          commandId: parsed.commandId,
          reason: phaseA.reason,
        });
      }
      const responseBody: { decision: "allow" | "deny"; reason?: string } = {
        decision: phaseA.decision,
        ...(phaseA.reason ? { reason: phaseA.reason } : {}),
      };
      safeJson(res, responseBody, {
        commandId: parsed.commandId,
        decision: phaseA.decision,
      });
      return;
    }

    // 3. Slow path: resolve display metadata, open the modal, and
    //    await a decision. This section runs OUTSIDE the lock so
    //    that multiple concurrent modals can coexist — we only want
    //    to serialize settings I/O, not user interaction.
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

    // Map modal outcome → final HTTP decision + persistence intent.
    let finalDecision: "allow" | "deny";
    let finalReason: string | undefined;
    let persistAllowlistEntry = false;

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
        // specific call. They differ only in whether the decision
        // is persisted for future invocations.
        finalDecision = "allow";
        finalReason = undefined;
        if (d === "allow-always") persistAllowlistEntry = true;
      }
    }

    // 4. Phase B — persist the final outcome under the settings
    //    lock. We re-read settings here so that any concurrent
    //    updates that happened while the modal was open (e.g. the
    //    user edited the allowlist via the settings UI) are
    //    preserved. The load/modify/save cycle is atomic thanks to
    //    the mutex.
    let persistedAllowlistEntry = false;
    await settingsMutex.run(async () => {
      const settings = (await plugin.loadData()) ?? {};
      const perms = settings.commandPermissions ?? {};

      const auditEntry: CommandAuditEntry = {
        timestamp: new Date().toISOString(),
        commandId: parsed.commandId,
        decision: finalDecision,
        ...(finalReason ? { reason: finalReason } : {}),
      };
      const updatedRecent = appendAuditEntry(
        perms.recentInvocations,
        auditEntry,
      );

      let updatedAllowlist: string[] | undefined;
      if (
        persistAllowlistEntry &&
        !(perms.allowlist ?? []).includes(parsed.commandId)
      ) {
        updatedAllowlist = [...(perms.allowlist ?? []), parsed.commandId];
        persistedAllowlistEntry = true;
      }

      settings.commandPermissions = {
        ...perms,
        ...(updatedAllowlist !== undefined
          ? { allowlist: updatedAllowlist }
          : {}),
        recentInvocations: updatedRecent,
      };
      await plugin.saveData(settings);
    });

    if (finalDecision === "allow") {
      logger.info("Command permission allowed", {
        commandId: parsed.commandId,
        persisted: persistedAllowlistEntry,
      });
    } else {
      logger.warn("Command permission denied", {
        commandId: parsed.commandId,
        reason: finalReason,
      });
    }

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
