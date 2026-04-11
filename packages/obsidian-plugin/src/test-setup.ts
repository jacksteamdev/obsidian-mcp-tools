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

  class FileSystemAdapter {
    getBasePath(): string {
      return "/fake/vault";
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
