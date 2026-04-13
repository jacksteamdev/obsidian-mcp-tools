import { beforeEach, describe, expect, test } from "bun:test";
import { CommandPermissionModal } from "./commandPermissionModal";

/**
 * Tests for CommandPermissionModal — the Svelte-hosting Modal wrapper
 * that bridges the HTTP permission-check handler and the UI prompt.
 *
 * The production code depends on two external modules:
 *
 *   - `Modal` from "obsidian" — stubbed in `test-setup.ts` with a
 *     minimal base class that invokes onOpen/onClose from open/close.
 *   - `mount`/`unmount` from "svelte" — stubbed in `test-setup.ts`
 *     with recorders that publish every call on
 *     `globalThis.__svelteMockCalls` so tests can:
 *       1. read the props passed to the Svelte component (to access
 *          the `onDecision` callback that the component would invoke
 *          on a real click), and
 *       2. assert that `unmount` was called with the component ref
 *          returned by `mount`.
 *
 * Every test resets the recorder in `beforeEach` so state does not
 * leak between cases.
 *
 * Note: `waitForDecision()` creates a fresh Promise on every call and
 * overwrites `resolveFn`, so production code only ever calls it once.
 * The tests respect that contract.
 */

interface SvelteMockCalls {
  mount: Array<{ component: unknown; options: { props?: unknown } }>;
  unmount: Array<unknown>;
}

function getSvelteMocks(): SvelteMockCalls {
  return (globalThis as unknown as { __svelteMockCalls: SvelteMockCalls })
    .__svelteMockCalls;
}

function resetSvelteMocks(): void {
  (globalThis as unknown as { __svelteMockCalls: SvelteMockCalls }).__svelteMockCalls =
    { mount: [], unmount: [] };
}

interface PromptProps {
  commandId: string;
  commandName?: string;
  isDestructive: boolean;
  showRateWarning: boolean;
  rateCount: number;
  onDecision: (decision: "allow-once" | "allow-always" | "deny") => void;
}

function promptPropsFromLastMount(): PromptProps {
  const call = getSvelteMocks().mount[0];
  if (!call) throw new Error("No mount call recorded");
  return call.options.props as PromptProps;
}

const fakeApp = {} as never;

const baseOpts = {
  commandId: "editor:toggle-bold",
  commandName: "Toggle bold",
  isDestructive: false,
  showRateWarning: false,
  rateCount: 0,
};

describe("CommandPermissionModal", () => {
  beforeEach(() => {
    resetSvelteMocks();
  });

  test("waitForDecision is pending until the user or a dismissal acts", async () => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();

    // Race the decision promise against a short timeout to confirm
    // that nothing resolves it on its own. 20ms is comfortably above
    // the microtask horizon while keeping the suite fast.
    const outcome = await Promise.race([
      modal.waitForDecision().then(() => "resolved" as const),
      new Promise<"pending">((r) => setTimeout(() => r("pending"), 20)),
    ]);
    expect(outcome).toBe("pending");
  });

  test.each([
    ["allow-once" as const],
    ["allow-always" as const],
    ["deny" as const],
  ])("onDecision(%s) from the Svelte component resolves the promise", async (decision) => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();
    const promise = modal.waitForDecision();

    promptPropsFromLastMount().onDecision(decision);

    expect(await promise).toBe(decision);
  });

  test("close() before any decision resolves the promise with 'deny'", async () => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();
    const promise = modal.waitForDecision();

    modal.close();

    expect(await promise).toBe("deny");
  });

  test("a second onDecision call is ignored — the first click wins", async () => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();
    const promise = modal.waitForDecision();

    const { onDecision } = promptPropsFromLastMount();
    onDecision("allow-once");
    onDecision("deny"); // racing second click must not override

    expect(await promise).toBe("allow-once");
  });

  test("explicit close() after a decision does not overwrite it", async () => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();
    const promise = modal.waitForDecision();

    promptPropsFromLastMount().onDecision("allow-always");
    // handleDecision already calls close() internally; a subsequent
    // explicit close from the caller must be a no-op.
    modal.close();

    expect(await promise).toBe("allow-always");
  });

  test("onOpen mounts the prompt with every option forwarded as a prop", () => {
    const opts = {
      commandId: "workspace:delete-current-file",
      commandName: "Delete current file",
      isDestructive: true,
      showRateWarning: true,
      rateCount: 42,
    };
    const modal = new CommandPermissionModal(fakeApp, opts);
    modal.open();

    const calls = getSvelteMocks().mount;
    expect(calls).toHaveLength(1);
    const props = calls[0]!.options.props as PromptProps;
    expect(props.commandId).toBe(opts.commandId);
    expect(props.commandName).toBe(opts.commandName);
    expect(props.isDestructive).toBe(opts.isDestructive);
    expect(props.showRateWarning).toBe(opts.showRateWarning);
    expect(props.rateCount).toBe(opts.rateCount);
    expect(typeof props.onDecision).toBe("function");
  });

  test("close() unmounts the Svelte component and empties contentEl", () => {
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    let emptyCount = 0;
    // Override contentEl with a spy-friendly stub; the base Modal
    // mock's default is a no-op empty() which we want to count.
    (modal as unknown as { contentEl: { empty: () => void } }).contentEl = {
      empty: () => {
        emptyCount++;
      },
    };

    modal.open();
    modal.close();

    expect(getSvelteMocks().unmount).toHaveLength(1);
    expect(emptyCount).toBe(1);
  });

  test("unmount is called with the ref returned by mount", () => {
    // The production code stores the mount return value and passes
    // it verbatim to unmount. Verifying this pairing guards against
    // a future refactor that accidentally unmounts the wrong handle.
    const modal = new CommandPermissionModal(fakeApp, baseOpts);
    modal.open();

    const mountedRef = (
      modal as unknown as { component?: unknown }
    ).component;
    expect(mountedRef).toBeDefined();

    modal.close();

    const unmountCalls = getSvelteMocks().unmount;
    expect(unmountCalls).toHaveLength(1);
    expect(unmountCalls[0]).toBe(mountedRef);
  });
});
