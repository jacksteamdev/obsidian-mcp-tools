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

mock.module("obsidian", () => {
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

  return {
    Notice,
    Plugin,
    FileSystemAdapter,
    TFile,
    PluginSettingTab,
    App,
  };
});
