import { beforeEach, describe, expect, test } from "bun:test";
import type { Request, Response } from "express";
import type { Plugin } from "obsidian";
import type { CommandAuditEntry } from "../types";
import { handleCommandPermissionRequest } from "./permissionCheck";

/**
 * Integration tests for the Express handler behind
 * `POST /mcp-tools/command-permission/`. The handler spans validation,
 * mutex-serialized settings I/O, modal invocation, and response
 * shaping; this suite covers each branch end-to-end with:
 *
 *   - A fake Plugin with in-memory loadData/saveData and a stub
 *     `app.commands.commands` registry so `resolveCommandName` can
 *     return a human name when appropriate.
 *   - Fake Request/Response objects that expose only the Express
 *     methods the handler touches (`status`, `json`, `writableEnded`).
 *   - The real `CommandPermissionModal` class, running on top of the
 *     Modal + Svelte stubs installed by `test-setup.ts`. The stubs
 *     publish every Svelte `mount` call on
 *     `globalThis.__svelteMockCalls`, so the test body simulates a
 *     user click by pulling the `onDecision` callback out of the
 *     recorded props and invoking it.
 *
 * Note on the 30-second modal timeout: the production constant lives
 * inside `permissionCheck.ts` and is not overridable, so the timeout
 * test swaps `globalThis.setTimeout` for a sub-millisecond variant
 * for the duration of that single case. The swap is reverted in the
 * test's `finally` block.
 */

// -------- Svelte mock helpers (shared contract with test-setup.ts) --------

interface SvelteMockCalls {
  mount: Array<{ component: unknown; options: { props?: unknown } }>;
  unmount: Array<unknown>;
}

interface PromptProps {
  commandId: string;
  commandName?: string;
  isDestructive: boolean;
  showRateWarning: boolean;
  rateCount: number;
  onDecision: (decision: "allow-once" | "allow-always" | "deny") => void;
}

function getSvelteMocks(): SvelteMockCalls {
  return (globalThis as unknown as { __svelteMockCalls: SvelteMockCalls })
    .__svelteMockCalls;
}

function resetSvelteMocks(): void {
  (globalThis as unknown as { __svelteMockCalls: SvelteMockCalls }).__svelteMockCalls =
    { mount: [], unmount: [] };
}

/**
 * Poll until `onOpen → mount(...)` has been recorded, or fail after
 * `timeoutMs`. Needed because the handler awaits an internal mutex
 * and a loadData() call before constructing the modal; the test must
 * yield to those microtasks before reading the mount props.
 */
async function waitForModalMount(timeoutMs = 500): Promise<PromptProps> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const call = getSvelteMocks().mount[0];
    if (call) return call.options.props as PromptProps;
    await new Promise((r) => setTimeout(r, 2));
  }
  throw new Error(
    `Modal mount did not occur within ${timeoutMs}ms — handler likely took the fast path`,
  );
}

// -------- Fake Plugin / Request / Response --------

interface FakePluginOptions {
  initialSettings?: Record<string, unknown>;
  /** Name registry: command id → display name. Optional. */
  commandNames?: Record<string, string>;
}

interface FakePlugin extends Plugin {
  __currentSettings: Record<string, unknown>;
  __saveCalls: number;
}

function createFakePlugin(opts: FakePluginOptions = {}): FakePlugin {
  let settings: Record<string, unknown> = structuredClone(
    opts.initialSettings ?? {},
  );
  const commandRegistry = Object.fromEntries(
    Object.entries(opts.commandNames ?? {}).map(([id, name]) => [
      id,
      { id, name },
    ]),
  );

  let saveCalls = 0;

  const app = {
    commands: {
      commands: commandRegistry,
    },
  };

  const fake = {
    app,
    loadData: async () => structuredClone(settings),
    saveData: async (next: Record<string, unknown>) => {
      settings = structuredClone(next);
      saveCalls++;
    },
    get __currentSettings() {
      return settings;
    },
    get __saveCalls() {
      return saveCalls;
    },
  } as unknown as FakePlugin;

  return fake;
}

interface FakeResponseCapture {
  statusCode: number;
  body?: unknown;
  jsonCalls: number;
}

function createFakeResponse(): { res: Response; capture: FakeResponseCapture } {
  const capture: FakeResponseCapture = {
    statusCode: 200,
    body: undefined,
    jsonCalls: 0,
  };
  const res: Partial<Response> = {
    writableEnded: false,
    status(code: number) {
      capture.statusCode = code;
      return this as Response;
    },
    json(body: unknown) {
      capture.jsonCalls++;
      capture.body = body;
      (res as { writableEnded: boolean }).writableEnded = true;
      return this as Response;
    },
  };
  return { res: res as Response, capture };
}

function createFakeRequest(body: unknown): Request {
  return { body } as unknown as Request;
}

function auditLog(plugin: FakePlugin): CommandAuditEntry[] {
  const perms = plugin.__currentSettings.commandPermissions as
    | { recentInvocations?: CommandAuditEntry[] }
    | undefined;
  return perms?.recentInvocations ?? [];
}

function allowlist(plugin: FakePlugin): string[] {
  const perms = plugin.__currentSettings.commandPermissions as
    | { allowlist?: string[] }
    | undefined;
  return perms?.allowlist ?? [];
}

// ------------------------------------------------------------
// Tests
// ------------------------------------------------------------

describe("handleCommandPermissionRequest", () => {
  beforeEach(() => {
    resetSvelteMocks();
  });

  // ---- validation ------------------------------------------------------

  test("returns 400 when the request body is missing commandId", async () => {
    const plugin = createFakePlugin();
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ wrong: "field" });

    await handleCommandPermissionRequest(plugin, req, res);

    expect(capture.statusCode).toBe(400);
    expect(capture.body).toMatchObject({ error: "Invalid request body" });
    expect(plugin.__saveCalls).toBe(0); // nothing persisted on validation failure
  });

  test("returns 400 when commandId is empty", async () => {
    const plugin = createFakePlugin();
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "" });

    await handleCommandPermissionRequest(plugin, req, res);

    expect(capture.statusCode).toBe(400);
  });

  // ---- fast path -------------------------------------------------------

  test("fast path: master toggle off → deny + audit entry", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: false, allowlist: [] },
      },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "editor:toggle-bold" });

    await handleCommandPermissionRequest(plugin, req, res);

    expect(capture.statusCode).toBe(200);
    expect(capture.body).toMatchObject({ decision: "deny" });
    expect((capture.body as { reason: string }).reason).toContain("disabled");

    const entries = auditLog(plugin);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      commandId: "editor:toggle-bold",
      decision: "deny",
    });
    // Fast path should not open a modal.
    expect(getSvelteMocks().mount).toHaveLength(0);
  });

  test("fast path: command already in allowlist → allow (no modal)", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: {
          enabled: true,
          allowlist: ["editor:toggle-bold"],
        },
      },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "editor:toggle-bold" });

    await handleCommandPermissionRequest(plugin, req, res);

    expect(capture.body).toMatchObject({ decision: "allow" });
    expect(getSvelteMocks().mount).toHaveLength(0);
    const entries = auditLog(plugin);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.decision).toBe("allow");
  });

  test("fast path: allowlist unchanged across repeat invocations", async () => {
    // Regression guard — fast-path allow must not append duplicates
    // to the allowlist. Only 'allow-always' should mutate allowlist.
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: {
          enabled: true,
          allowlist: ["editor:toggle-bold"],
        },
      },
    });

    for (let i = 0; i < 3; i++) {
      const { res } = createFakeResponse();
      const req = createFakeRequest({ commandId: "editor:toggle-bold" });
      await handleCommandPermissionRequest(plugin, req, res);
    }

    expect(allowlist(plugin)).toEqual(["editor:toggle-bold"]);
    expect(auditLog(plugin)).toHaveLength(3);
  });

  // ---- slow path (modal) ----------------------------------------------

  test("slow path: master on, not in allowlist → opens modal", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: [] },
      },
      commandNames: { "editor:toggle-bold": "Toggle bold" },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "editor:toggle-bold" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();

    expect(props.commandId).toBe("editor:toggle-bold");
    expect(props.commandName).toBe("Toggle bold");
    expect(props.isDestructive).toBe(false);

    // Resolve the modal so the handler can complete.
    props.onDecision("allow-once");
    await handlerPromise;

    expect(capture.body).toMatchObject({ decision: "allow" });
  });

  test("slow path: allow-once → allow, allowlist unchanged", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: [] },
      },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "graph:open" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();
    props.onDecision("allow-once");
    await handlerPromise;

    expect(capture.body).toMatchObject({ decision: "allow" });
    expect(allowlist(plugin)).toEqual([]); // NOT persisted
    const entries = auditLog(plugin);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      commandId: "graph:open",
      decision: "allow",
    });
  });

  test("slow path: allow-always → allow AND commandId appended to allowlist", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: ["pre-existing"] },
      },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "graph:open" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();
    props.onDecision("allow-always");
    await handlerPromise;

    expect(capture.body).toMatchObject({ decision: "allow" });
    expect(allowlist(plugin)).toEqual(["pre-existing", "graph:open"]);
  });

  test("slow path: allow-always on a command already in the allowlist is a no-op for the list", async () => {
    // Guards against O(N²) growth if a race produced a duplicate
    // submission: the handler's dedupe check should keep the list clean.
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: {
          enabled: true,
          allowlist: ["graph:open"],
        },
      },
    });
    const { res } = createFakeResponse();
    const req = createFakeRequest({ commandId: "graph:open" });

    // Command IS in allowlist, so this takes the FAST path — no modal
    // expected. The list should be unchanged after the call.
    await handleCommandPermissionRequest(plugin, req, res);

    expect(allowlist(plugin)).toEqual(["graph:open"]); // no duplicate
  });

  test("slow path: user clicks deny → response deny with 'user denied' reason", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: [] },
      },
    });
    const { res, capture } = createFakeResponse();
    const req = createFakeRequest({ commandId: "graph:open" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();
    props.onDecision("deny");
    await handlerPromise;

    expect(capture.body).toMatchObject({ decision: "deny" });
    expect((capture.body as { reason: string }).reason).toContain(
      "User denied",
    );
    expect(allowlist(plugin)).toEqual([]); // no side effect on deny
  });

  test("slow path: modal timeout → response deny with timeout reason", async () => {
    // The production handler waits up to 30s for a modal decision.
    // We swap globalThis.setTimeout with a fast variant for the
    // duration of this test so the 30s guard trips immediately.
    const realSetTimeout = globalThis.setTimeout;
    (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
      cb: () => void,
      _ms: number,
      ...args: unknown[]
    ) => realSetTimeout(cb, 1, ...args)) as typeof setTimeout;

    try {
      const plugin = createFakePlugin({
        initialSettings: {
          commandPermissions: { enabled: true, allowlist: [] },
        },
      });
      const { res, capture } = createFakeResponse();
      const req = createFakeRequest({ commandId: "graph:open" });

      // Don't simulate a click — let the timeout fire.
      await handleCommandPermissionRequest(plugin, req, res);

      expect(capture.body).toMatchObject({ decision: "deny" });
      expect((capture.body as { reason: string }).reason).toContain(
        "did not respond",
      );
    } finally {
      (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout =
        realSetTimeout;
    }
  });

  // ---- heuristics surfaced in modal props -----------------------------

  test("destructive command id → isDestructive=true in modal props", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: [] },
      },
    });
    const { res } = createFakeResponse();
    const req = createFakeRequest({ commandId: "myPlugin:delete-everything" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();

    expect(props.isDestructive).toBe(true);

    // Clean up: resolve the modal so the handler completes.
    props.onDecision("deny");
    await handlerPromise;
  });

  test("non-destructive command id → isDestructive=false", async () => {
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: { enabled: true, allowlist: [] },
      },
    });
    const { res } = createFakeResponse();
    const req = createFakeRequest({ commandId: "editor:toggle-bold" });

    const handlerPromise = handleCommandPermissionRequest(plugin, req, res);
    const props = await waitForModalMount();

    expect(props.isDestructive).toBe(false);

    props.onDecision("deny");
    await handlerPromise;
  });

  // ---- concurrency -----------------------------------------------------

  test("multiple concurrent fast-path calls all persist audit entries (mutex regression)", async () => {
    // Regression guard for the race fixed in Fase 2: N parallel
    // allow-path calls must all land in the audit log, not just the
    // last writer's view. The mutex serializes load/modify/save.
    const plugin = createFakePlugin({
      initialSettings: {
        commandPermissions: {
          enabled: true,
          allowlist: ["editor:toggle-bold"],
        },
      },
    });

    const N = 10;
    const runs = Array.from({ length: N }, () => {
      const { res } = createFakeResponse();
      const req = createFakeRequest({ commandId: "editor:toggle-bold" });
      return handleCommandPermissionRequest(plugin, req, res);
    });
    await Promise.all(runs);

    expect(auditLog(plugin)).toHaveLength(N);
  });
});
