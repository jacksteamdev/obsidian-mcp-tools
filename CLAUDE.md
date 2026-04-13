# CLAUDE.md

Guidance for Claude Code (and similar AI agents) working in this repository.

## Project

**MCP Tools for Obsidian** — a Model Context Protocol (MCP) bridge that lets AI clients such as Claude Desktop access an Obsidian vault for reading, writing, searching (text + semantic), and executing templates, without bypassing Obsidian itself.

Two shipping components glued together by the Local REST API plugin:

1. **Obsidian plugin** — installs/updates a signed MCP server binary, writes `claude_desktop_config.json`, and exposes extra HTTP endpoints that the server calls back into (semantic search via Smart Connections, template execution via Templater).
2. **MCP server binary** — long-lived subprocess launched by Claude Desktop over stdio. Translates MCP tool/prompt calls into HTTPS requests against the Obsidian Local REST API plugin on `127.0.0.1:27124`.

Why the detour through Local REST API instead of reading `.md` files directly: it preserves Obsidian's metadata cache, respects file locks on open notes, and lets the server invoke other Obsidian plugins (Templater, Smart Connections, Dataview) through their APIs.

Current version: **0.2.27** (see root `package.json`). License: MIT.

### Fork status

Active work happens on the **`istefox/obsidian-mcp-tools`** fork (remote `myfork`). Upstream `jacksteamdev/obsidian-mcp-tools` is effectively dormant — treat it as frozen. For the list of open upstream items still relevant, see "Pending work" at the bottom; everything else has been landed locally and is visible in `git log`.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Bun workspaces (`bun.lock`) — **do not use npm/yarn/pnpm** |
| Toolchain pinning | `mise.toml` (bun latest) |
| Language | TypeScript 5, strict mode, `verbatimModuleSyntax: true` |
| Runtime validation | **ArkType** (`arktype` 2.0.0-rc.30) at every external boundary |
| MCP | `@modelcontextprotocol/sdk` 1.29.0 (fork) |
| UI | Svelte 5.17 inside the Obsidian plugin (patched — see `patches/svelte@5.16.0.patch`) |
| Reactive deps | RxJS 7.8 (polls other Obsidian plugins until loaded) |
| HTML→Markdown | Turndown 7.2 |
| Test | `bun:test` (native) |
| Format | Prettier 3 (`.prettierrc.yaml`) — 2-space indent, 80 col |
| Build | `bun build --compile` for the server binary, custom `bun.config.ts` for the plugin |
| CI | GitHub Actions (`.github/workflows/release.yml`) — cross-platform binaries + SLSA provenance |

Path alias inside every package: **`$/*` → `src/*`**. Use it instead of relative imports across feature boundaries.

## Commands

From the repo root. See each package's `package.json` for the full script list.

```bash
bun install                           # Install all workspace dependencies
bun run check                         # Type-check every package (tsc --noEmit)
bun run dev                           # Watch all packages in parallel
bun run release                       # Cross-platform release build
bun run version [patch|minor|major]   # Atomic version bump + commit + tag
```

Per-package notable scripts: `bun run inspector` in `packages/mcp-server` launches `@modelcontextprotocol/inspector` — **primary debugging tool** for server work. `bun run link` in `packages/obsidian-plugin` symlinks the built plugin into a local vault.

## Architecture

### Layout

- `packages/mcp-server/` — standalone MCP server, compiled to a binary
- `packages/obsidian-plugin/` — Obsidian plugin (TS + Svelte 5)
- `packages/shared/` — ArkType schemas, logger, cross-package types
- `packages/test-site/` — SvelteKit harness, not part of the shipped product
- `docs/` — architecture + feature specs (see References)
- `.clinerules` — **authoritative architecture contract, read first**

### Data flow

```
Claude Desktop
    │  stdio (JSON-RPC / MCP protocol)
    ▼
mcp-server binary                      (reads env OBSIDIAN_API_KEY at startup)
    │  HTTPS, self-signed cert, API key header
    ▼
Obsidian Local REST API plugin         (listens on 127.0.0.1:27124)
    │  in-process function calls
    ▼
Obsidian (vault, Templater, Smart Connections, Dataview)
```

The MCP server **never** touches the vault filesystem directly, even when it would be faster. Bypassing Obsidian corrupts its metadata cache and breaks live editing.

### Entry points

- **Server**: `packages/mcp-server/src/index.ts` → instantiates `ObsidianMcpServer` (`features/core/index.ts`), wires the stdio transport, fans out feature registration.
- **Plugin**: `packages/obsidian-plugin/src/main.ts` → `class McpToolsPlugin extends Plugin`, loads features via their `setup()` functions, registers the settings tab.
- **Shared**: `packages/shared/src/index.ts` → re-exports logger and types.

### Feature-based architecture

Every feature is a self-contained module in `src/features/<name>/` with a stable public shape (see `.clinerules` for the canonical spec):

```
feature/
├── components/   # Svelte UI (plugin only)
├── services/     # Business logic
├── constants/
├── types.ts      # ArkType schemas + TS types
├── utils.ts
└── index.ts      # Public API + setup function
```

Each `index.ts` exports a `setup()` that returns `{ success: true } | { success: false, error: string }`. A failing setup **must not** throw — return the error object so other features keep loading and the failure surfaces in the settings UI.

### Tool registration pattern (server)

Every MCP tool is declared with an ArkType schema + async handler through the shared `ToolRegistry` (never registered directly against the MCP SDK):

```typescript
tools.register(
  type({
    name: '"search_vault_smart"',
    arguments: {
      query: type("string>0").describe("A search phrase for semantic search"),
      "filter?": { /* ... */ },
    },
  }).describe("Human-readable tool description shown to the model"),
  async ({ arguments: args }) => {
    const data = await makeRequest(ResponseSchema, "/endpoint", { /* ... */ });
    return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
  },
);
```

Rules:

- **Always** add `.describe()` on fields and on the top-level schema — that text becomes the model-facing documentation.
- Return MCP results shaped as `{ content: [{ type: "text", text: ... }] }`.
- Throw `new McpError(ErrorCode.*, message)` for protocol-level failures.
- **Boolean parameters arrive as strings** (`"true"`/`"false"`) from older MCP clients — `ToolRegistry` handles coercion centrally. Do not re-implement per tool; see `templates/index.ts` for an explicit `type("'true'|'false'")` workaround kept for belt-and-suspenders.
- Validate every untrusted JSON payload with ArkType first. Idiomatic pattern: `type("string.json.parse").pipe(schema)` — parses and validates in one expression. Use `.to()` to chain further transformations.
- **`ToolRegistry` is the only sanctioned way** to register tools and prompts. Do not register raw MCP handlers against the SDK directly. This is how boolean coercion, error formatting, and logging stay uniform.

## MCP surface (what this server exposes)

Capabilities declared: **`tools`** and **`prompts`**. No MCP resources are exposed.

### Tools (20 total)

**Vault file management** — `packages/mcp-server/src/features/local-rest-api/index.ts`:

| Tool | Purpose |
|---|---|
| `get_server_info` | Local REST API status + auth check. Only tool that works without auth. |
| `get_active_file` | Content of the currently active note (markdown or JSON with tags + frontmatter). |
| `update_active_file` | Replace content of the active note. |
| `append_to_active_file` | Append to the active note. |
| `patch_active_file` | Insert/modify content relative to a heading, block reference, or frontmatter field. |
| `delete_active_file` | Delete the active note. |
| `show_file_in_obsidian` | Open a note in the Obsidian UI (optionally in a new leaf); creates it if missing. |
| `list_vault_files` | List files in a directory (root by default). |
| `get_vault_file` | Read an arbitrary file from the vault. |
| `create_vault_file` | Create or overwrite a file. |
| `append_to_vault_file` | Append to an arbitrary file. |
| `patch_vault_file` | Heading/block/frontmatter-aware insert into a file. |
| `delete_vault_file` | Delete a file. |
| `search_vault` | Search via Dataview DQL or JsonLogic query. |
| `search_vault_simple` | Plain text search with context window. |

**Semantic search** — `features/smart-connections/index.ts`:

| Tool | Purpose |
|---|---|
| `search_vault_smart` | Semantic search delegated to the Smart Connections plugin (`/search/smart` endpoint registered by this repo's plugin). Supports folder include/exclude filters and result limits. |

**Templater integration** — `features/templates/index.ts`:

| Tool | Purpose |
|---|---|
| `execute_template` | Execute a Templater template with dynamic arguments, optionally creating a new file at `targetPath`. Arguments are validated dynamically from the template's parameter syntax. |

**Web fetch** — `features/fetch/index.ts`:

| Tool | Purpose |
|---|---|
| `fetch` | Retrieve any URL and return Markdown (via Turndown) or raw HTML. Supports pagination (`maxLength`/`startIndex`) with built-in truncation hint. |

**Command execution** — `features/commands/index.ts`:

| Tool | Purpose |
|---|---|
| `list_obsidian_commands` | Read-only discovery. Returns every command registered in the vault (core + plugins) with optional substring filter. Always safe, no permission gate. |
| `execute_obsidian_command` | Gated execution. Every call goes through a rate limiter (100/minute tumbling window) and then the plugin's `/mcp-tools/command-permission/` endpoint, which checks the master toggle + per-command allowlist. Disabled by default. The plugin-side soft warning threshold (default 30/min) is user-configurable via the Advanced disclosure in settings (`commandPermissions.softRateLimit`). |

### Prompts

Prompts are **dynamically discovered** from the vault, not hardcoded — see `features/prompts/index.ts`:

- Source directory: `Prompts/` at the vault root.
- A file becomes an MCP prompt only if it has the tag `#mcp-tools-prompt`.
- Prompt arguments are parsed from Templater template syntax in the file body (`parseTemplateParameters`).
- On `GetPrompt`, the server runs the template through `/templates/execute` (Templater plugin), strips frontmatter, and returns the result as a user message.

This means prompt schemas are **runtime data**: they depend on the user's vault contents and change when they edit a prompt note. Full reference in `docs/features/prompt-system.md`.

## Conventions

Full spec lives in `.clinerules`. Highlights:

- **TypeScript strict mode** everywhere, no exceptions. `verbatimModuleSyntax: true` — use `import type` for type-only imports.
- **Prefer functional over OOP.** Pure functions, single responsibility, action-oriented names (`installMcpServer`, `getInstallationStatus`).
- **Never reach the filesystem** from the server process except for logging. All vault access goes through `makeRequest()` → Local REST API.
- **Never use `console.log`** in production code — use the shared `logger` from `packages/shared/src/logger.ts` with a structured context object (`logger.error("message", { requestId, error })`).
- **Settings are augmented via TypeScript module augmentation**, not a central types file:
  ```typescript
  declare module "obsidian" {
    interface McpToolsPluginSettings {
      myFeature?: { /* ... */ };
    }
  }
  ```
- **ArkType validation at every boundary** — external fetch responses, REST endpoint payloads, MCP tool arguments, prompt frontmatter. Add `.describe()` to improve error messages.
- **Feature name kebab-case**, **function camelCase**, **type PascalCase**, **constant SCREAMING_SNAKE_CASE**.

## Gotchas

Active traps in the current tree. Historical bugs already fixed in the fork are in `git log` — don't clutter this list with them.

- **`patches/svelte@5.16.0.patch`** forces Svelte to use `index-client.js` instead of `index-server.js` — required for Bun bundler compatibility. Re-verify if you upgrade Svelte.
- **Self-signed HTTPS**: the server sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` inside `makeRequest.ts`. Removing or relocating this breaks every server→Obsidian call.
- **`packages/mcp-server/dist/`** is gitignored — CI regenerates binaries on tagged releases. Run `bun run build` locally for `dist/mcp-server`, or the per-target scripts (`build:mac-arm64`, `build:mac-x64`, `build:linux`, `build:windows`), but never commit the output.
- **Version bumps must go through `bun run version`** — it atomically updates `package.json`, `manifest.json`, `versions.json` and creates the git commit + tag. Manual edits get out of sync.
- **`packages/obsidian-plugin/main.js` is written at the package root, not `dist/`** — Obsidian expects that path. Do not move it.
- **External modules in `bun.config.ts`** (`obsidian`, `@codemirror/*`, `@lezer/*`) must stay external. Bundling them breaks the plugin on load.
- **Version macro** in `features/version/index.ts` uses Bun's `with { type: "macro" }` / `with { type: "json" }` import attribute — works on Bun's compile path, will break under plain tsc emit.
- **Smart Connections compatibility**: the plugin wrapper handles both v2.x (`window.SmartSearch`) and v3.0+ (`smartEnv.smart_sources`). Preserve both code paths when modifying.
- **`execute_template.createFile`** is typed as the string `"true"|"false"` (not boolean) because older MCP clients serialize booleans as strings — explicit workaround in `features/templates/index.ts`, kept as belt-and-suspenders for SDK 1.29.0.
- **`plugin.loadData()` / `plugin.saveData()` are NOT atomic** — default Obsidian persistence is two independent async calls. Any feature doing `load → modify → save` in response to concurrent events MUST serialize with a mutex. See `features/command-permissions/services/settingsLock.ts` for the canonical implementation + 35-way regression test.
- **Command-permission policy invariants** — `features/command-permissions/` is the security boundary for `execute_obsidian_command`. Whenever you touch `permissionCheck.ts`, preserve these load-bearing properties: (1) **deny by default** — `enabled !== true` short-circuits to deny BEFORE any allowlist check; (2) **two-phase mutex** — Phase A (load + decide-or-detect-modal-needed + save-on-fast-path) holds the lock; modal wait runs OUTSIDE the lock; Phase B (re-load + persist final outcome) re-acquires it, so concurrent requests serialize their I/O without serializing user interaction; (3) **the destructive heuristic is a nudge, not a gate** — matching commands disable "Allow always" but "Allow once" still works; presets in `presets.ts` MUST exclude every word the regex catches; (4) **allowlist entries are exact ids** — no wildcard support, deliberate. The full threat model and option matrix lives in `docs/design/issue-29-command-execution.md` — read it before changing the policy shape.
- **Every `from "obsidian"` import in `packages/shared/` must be `import type`.** The npm `obsidian` package ships only `.d.ts`; Obsidian injects the runtime module at plugin load. A value import survives `verbatimModuleSyntax` and fails `bun build --compile` with `Could not resolve "obsidian"`. The `packages/obsidian-plugin/` package is fine — value imports there are legitimate.

## Testing & CI

- Framework: `bun:test` (`import { describe, expect, test } from "bun:test"`).
- Tests live next to the code (`*.test.ts`). Run a single file with `bun test <path>`; run a whole package with `cd packages/<name> && bun test`. There is no monorepo-wide fan-out today — run `bun run check` from the root, then `bun test` in each package.
- **Plugin test infrastructure**:
  - `packages/obsidian-plugin/bunfig.toml` — `[test] preload` registers a synthetic `"obsidian"` module via `src/test-setup.ts`, so tests can import production modules that reference `Plugin`, `Notice`, `FileSystemAdapter`, `TFile`, etc.
  - `packages/obsidian-plugin/src/test-setup.ts` — the module mock. `FileSystemAdapter` accepts an optional `basePath` for anchoring tests at a real temp directory. Production code never constructs it itself — Obsidian does — so the extra parameter is invisible to the ship build. Also stubs `Modal` (shallow base class with `onOpen`/`onClose` plumbing) and the `svelte` module's `mount`/`unmount` as recorders — every call is published on `globalThis.__svelteMockCalls.{mount,unmount}` so tests can both inspect component props (including callback handles like `onDecision`) and assert mount/unmount pairing. Tests that use these helpers must reset `__svelteMockCalls` in `beforeEach` for isolation.
  - `packages/obsidian-plugin/.env.test` — fake `GITHUB_DOWNLOAD_URL` / `GITHUB_REF_NAME` for the build-time `environmentVariables()` macro. Bun auto-loads when `bun test` runs.
  - **Stubbing `os.homedir()`**: use `spyOn(os, "homedir").mockReturnValue(tmpRoot)` — Bun/Node cache HOME early, so runtime `process.env.HOME = …` is not reliable. See `config.test.ts` and `uninstall.test.ts`.
  - **Installer integration tests** use real shell scripts as fake binaries (tmpdir, `mode: 0o755`) instead of mocking `child_process.exec`. See `status.integration.test.ts`. macOS-guarded (shebang approach is Unix-only).
- **Still uncovered**: `installMcpServer` orchestration wrapper, `downloadFile` (HTTP + stream), Svelte component rendering (covered only by `svelte-check` and manual `bun run link` smoke tests).
- CI: `.github/workflows/release.yml` triggers on tag push, runs `bun run release`, cross-compiles all platforms, generates SLSA provenance, uploads release artifacts. **No test step in CI yet** — keep tests green locally before merging to `myfork/main`.

## Pre-commit checklist

**For any change:**

1. **`bun run check`** (at repo root) — TypeScript strict check across all packages. Must pass.
2. **Never bump version fields by hand.** Use `bun run version [patch|minor|major]`.

**For changes in `packages/mcp-server/`:**

3. **`bun test`** — existing tests must pass. Add tests when touching parsing or conversion logic.
4. **`bun run inspector`** — verify new/modified tools register correctly, expose the expected schema, return well-formed MCP results.

**For changes in `packages/obsidian-plugin/`:**

3. **`bun run build`** from the package — a clean prod build must succeed.
4. **Manual integration test** — `bun run link` into a throwaway vault, enable the plugin, verify: server install flow, Claude Desktop config write, REST endpoint registration, settings UI. Type checks do not catch UI or install-flow regressions.

**For changes in `packages/shared/`:**

3. **`bun run check` at the repo root** (again) — shared-package changes cascade; both runtime packages must still type-check.

## Project status

Upstream `jacksteamdev/obsidian-mcp-tools` is effectively dormant since 2025-07 (maintainer call closed 2025-09-30, no new maintainer named, 23 issues + 23 PRs accumulated without merges as of 2026-04-11). Treat upstream as frozen. If you need a fix, expect to fork or cherry-pick.

## Pending work

Items still open upstream **and** not yet addressed in the fork:

1. **Maintainership stance** — decide between upstream contribution (needs jacksteamdev buy-in) or permanent fork-and-rebrand (rename package, change `manifest.json` → `id`). Currently the fork still ships under the original `obsidian-mcp-tools` id.
2. **PR #44 (OAuth)** and **PR #20 (multi-vault)** — ambitious upstream PRs, not evaluated.
3. **Binary content types for `get_vault_file`** — SDK 1.29.0 now supports native audio/image responses; commit `f6d004a` left a text short-circuit in place to keep the SDK bump's blast radius small. Can now be replaced.
4. **Stale remote branches on `origin`** — only relevant if maintainership migrates.

(#29 Fase 1 + 2 + 3 all landed on `myfork/main` — see `git log --first-parent` for the four Fase 3 merge commits.)

Everything else from prior planning docs has landed on `myfork/main` — check `git log` for SHAs.

## References

**In-repo docs** (read before implementing a new feature):

- `.clinerules` — authoritative feature architecture, ArkType conventions, error handling contract.
- `docs/project-architecture.md` — monorepo overview (aligned with `.clinerules`).
- `docs/features/mcp-server-install.md` — installer feature spec.
- `docs/features/prompt-system.md` — authoritative reference for the prompt feature. Read before touching `packages/mcp-server/src/features/prompts/` or the template execution endpoint in the plugin.
- `docs/design/issue-29-command-execution.md` — fork design review for Obsidian command execution (threat model, policy options, phased plan). Authoritative when resuming issue #29 / PR #47.
- `CONTRIBUTING.md`, `SECURITY.md`.

**Live project state**:

- [Open issues](https://github.com/jacksteamdev/obsidian-mcp-tools/issues) / [Open PRs](https://github.com/jacksteamdev/obsidian-mcp-tools/pulls) — always cross-check GitHub for anything landed since.
- Discord `#maintainers` channel (invite in README) — low traffic, contains root-cause analysis for `patch_vault_file`.
- [Jason Bates fork](https://github.com/JasonBates/obsidian-mcp-tools), commit [`8adb7dd`](https://github.com/JasonBates/obsidian-mcp-tools/commit/8adb7dd0e1c47081f15908950b89e96b7417d12a) — unsubmitted `resolveHeadingPath` fix, cherry-pick source of truth if the heading-path logic needs more work.

**Upstream dependencies worth knowing**:

- [Model Context Protocol spec](https://modelcontextprotocol.io) — for boolean/schema shape gotchas.
- [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) — the HTTPS bridge this server depends on.
- [Local REST API OpenAPI reference](https://coddingtonbear.github.io/obsidian-local-rest-api/) — especially `PATCH /vault/{filename}`, whose header-based request format is hard to generate correctly.
