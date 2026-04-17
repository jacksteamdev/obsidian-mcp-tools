/**
 * Obsidian Modal wrapper that hosts the CommandPermissionPrompt
 * Svelte component and exposes a promise-based decision API.
 *
 * This is the bridge between:
 *
 *   1. The HTTP handler in `permissionCheck.ts`, which needs to
 *      `await` a user decision before responding to the MCP server;
 *   2. The Svelte UI in `CommandPermissionPrompt.svelte`, which is
 *      a presentational component that just calls back when a button
 *      is clicked.
 *
 * Usage from the handler:
 *
 *   const modal = new CommandPermissionModal(plugin.app, {...});
 *   modal.open();
 *   const decision = await modal.waitForDecision();
 *   // …handler acts on decision and returns HTTP response
 *
 * Lifecycle notes:
 *
 * - `onOpen()` is called by the Obsidian Modal base class after the
 *   DOM container is ready. We mount the Svelte component there.
 * - `onClose()` is called when the modal is dismissed for ANY reason
 *   — a button click, the X, the Esc key, a backdrop click, or an
 *   explicit `modal.close()` from the handler (e.g. on timeout). We
 *   unmount the Svelte and, if no decision has been resolved yet,
 *   resolve the promise with `"deny"` so the handler never hangs on
 *   a dismissed modal.
 *
 * The `resolved` flag guards against double-resolve: if the user
 * clicks a button, we close the modal, which fires `onClose`, which
 * would otherwise try to resolve with `"deny"` on top of the already-
 * resolved decision. The flag short-circuits the second call.
 */

import { Modal, type App } from "obsidian";
import { mount, unmount } from "svelte";
import CommandPermissionPrompt from "../components/CommandPermissionPrompt.svelte";

export type ModalDecision = "allow-once" | "allow-always" | "deny";

export interface CommandPermissionModalOptions {
  commandId: string;
  commandName?: string;
  isDestructive: boolean;
  showRateWarning: boolean;
  rateCount: number;
}

export class CommandPermissionModal extends Modal {
  private readonly opts: CommandPermissionModalOptions;
  // `mount` returns an exports record whose exact shape depends on
  // the component; we only need to pass it back to `unmount`, so the
  // narrowest useful type here is `ReturnType<typeof mount>`.
  private component?: ReturnType<typeof mount>;
  private resolved = false;
  private resolveFn?: (decision: ModalDecision) => void;

  constructor(app: App, opts: CommandPermissionModalOptions) {
    super(app);
    this.opts = opts;
  }

  /**
   * Returns a promise that settles exactly once — when the user
   * clicks a button, or when the modal is dismissed, or when the
   * handler explicitly calls `close()` after a timeout. The caller
   * is responsible for racing this against its own timeout if it
   * wants a bounded wait (see `permissionCheck.ts`).
   */
  waitForDecision(): Promise<ModalDecision> {
    return new Promise((resolve) => {
      this.resolveFn = resolve;
    });
  }

  private handleDecision = (decision: ModalDecision) => {
    if (this.resolved) return;
    this.resolved = true;
    this.resolveFn?.(decision);
    this.close();
  };

  onOpen() {
    this.component = mount(CommandPermissionPrompt, {
      target: this.contentEl,
      props: {
        commandId: this.opts.commandId,
        commandName: this.opts.commandName,
        isDestructive: this.opts.isDestructive,
        showRateWarning: this.opts.showRateWarning,
        rateCount: this.opts.rateCount,
        onDecision: this.handleDecision,
      },
    });
  }

  onClose() {
    // Dismissal without a button click (X, Esc, backdrop, programmatic
    // close on timeout) is treated as a deny. This must happen BEFORE
    // the unmount so the handler's `await` resolves with a meaningful
    // value.
    if (!this.resolved) {
      this.resolved = true;
      this.resolveFn?.("deny");
    }
    if (this.component) {
      void unmount(this.component);
      this.component = undefined;
    }
    this.contentEl.empty();
  }
}
