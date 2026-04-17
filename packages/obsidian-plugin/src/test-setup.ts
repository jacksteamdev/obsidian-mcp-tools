/**
 * Test-only setup file, loaded by bun:test via `bunfig.toml` preload.
 *
 * The `obsidian` npm package ships only TypeScript declarations —
 * there is no runtime JavaScript. At production runtime, Obsidian
 * itself injects the module when it loads the plugin. For unit tests
 * running outside Obsidian, any file that imports a named binding
 * from "obsidian" (e.g. `Plugin`, `Notice`, `FileSystemAdapter`) will
 * crash at module load with `Cannot find package 'obsidian'`.
 *
 * This preload registers a synthetic module for "obsidian" so such
 * imports resolve to no-op stubs. Tests that need to assert specific
 * Obsidian runtime behavior (e.g. verifying `new Notice(...)` was
 * called with a specific message) should override these stubs with
 * their own per-test spies via `spyOn`.
 *
 * NOTE: this file is intentionally NOT imported anywhere in the
 * production code. The bundler entrypoint is `src/main.ts`, so this
 * module is not included in the shipped plugin.
 */

import { mock } from "bun:test";

void mock.module("obsidian", () => {
  class Notice {
    constructor(_message?: string, _timeout?: number) {}
    setMessage(_message: string | DocumentFragment) {
      return this;
    }
    hide() {}
  }

  class Plugin {}

  /**
   * Configurable stub for Obsidian's FileSystemAdapter. Tests that
   * need to anchor the plugin's vault at a real temp directory pass
   * the path to the constructor:
   *
   *     import { FileSystemAdapter } from "obsidian";
   *     const adapter = new FileSystemAdapter(tmpRoot);
   *
   * The production code never constructs a FileSystemAdapter itself
   * — Obsidian injects one via `plugin.app.vault.adapter` — so the
   * extra constructor argument is invisible to the prod build path.
   */
  class FileSystemAdapter {
    #basePath: string;
    constructor(basePath: string = "/fake/vault") {
      this.#basePath = basePath;
    }
    getBasePath(): string {
      return this.#basePath;
    }
  }

  class TFile {}

  class PluginSettingTab {}

  class App {}

  /**
   * Shallow stub of Obsidian's `Modal` base class. Exposes only what
   * subclasses under test actually touch:
   *
   *   - `contentEl` — the DOM container where Svelte components are
   *     mounted. We stub `empty()` (called in `onClose`) as a no-op.
   *   - `open()` / `close()` — public entry points. They invoke the
   *     subclass's `onOpen()` / `onClose()` hooks synchronously, which
   *     is enough to exercise the lifecycle contract in tests. Real
   *     Obsidian adds DOM transitions and focus management; neither
   *     matters here.
   *
   * The `resolved`-guard semantics of `CommandPermissionModal` rely on
   * `close()` triggering `onClose()` exactly once even when called
   * multiple times, so we track that with a flag.
   */
  class Modal {
    app: unknown;
    contentEl: { empty: () => void } = { empty: () => {} };
    private _closed = false;
    constructor(app: unknown) {
      this.app = app;
    }
    onOpen() {}
    onClose() {}
    open() {
      this._closed = false;
      this.onOpen();
    }
    close() {
      if (this._closed) return;
      this._closed = true;
      this.onClose();
    }
  }

  return {
    Notice,
    Plugin,
    FileSystemAdapter,
    TFile,
    PluginSettingTab,
    App,
    Modal,
  };
});

/**
 * Mock Svelte's `mount`/`unmount` so we can exercise Obsidian Modal
 * lifecycle without a real DOM runtime. The mock records every call
 * on `globalThis.__svelteMockCalls` so tests can:
 *
 *   1. inspect the props passed to the component (including the
 *      `onDecision` callback);
 *   2. simulate a user click by invoking that callback directly;
 *   3. assert that `unmount` was called with the same component ref
 *      that `mount` returned.
 *
 * Tests should reset the recorder in `beforeEach` to keep per-test
 * isolation (`(globalThis as any).__svelteMockCalls = { mount: [], unmount: [] }`).
 */
interface SvelteMockCalls {
  mount: Array<{ component: unknown; options: { props?: unknown } }>;
  unmount: Array<unknown>;
}

(globalThis as unknown as { __svelteMockCalls: SvelteMockCalls }).__svelteMockCalls = {
  mount: [],
  unmount: [],
};

void mock.module("svelte", () => ({
  mount: (component: unknown, options: { props?: unknown }) => {
    const ref = { __mockRef: Symbol("svelte-mock-ref"), component, options };
    (
      globalThis as unknown as { __svelteMockCalls: SvelteMockCalls }
    ).__svelteMockCalls.mount.push({ component, options });
    return ref;
  },
  unmount: (ref: unknown) => {
    (
      globalThis as unknown as { __svelteMockCalls: SvelteMockCalls }
    ).__svelteMockCalls.unmount.push(ref);
  },
}));
