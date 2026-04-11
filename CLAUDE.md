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

Active work on this tree happens in the **`istefox/obsidian-mcp-tools`** fork (remote `myfork`), not upstream. Upstream `jacksteamdev/obsidian-mcp-tools` is effectively dormant (see Project status below). The "Open issues & PRs snapshot" section further down lists upstream state frozen at 2026-04-11; items the fork has **already landed locally** are marked with ✅ and a commit SHA — those commits exist only on `myfork/main`, not on `origin/main`. When reading Gotchas, check for the `[FORK: FIXED …]` prefix to know whether a trap still applies to the working tree you're in.

## Stack

| Layer | Tech |
|---|---|
| Monorepo | Bun workspaces (`bun.lock`) — **do not use npm/yarn/pnpm** |
| Toolchain pinning | `mise.toml` (bun latest) |
| Language | TypeScript 5, strict mode everywhere, `verbatimModuleSyntax: true` |
| Runtime validation | **ArkType** (`arktype` 2.0.0-rc.30) — used for every external boundary |
| MCP | `@modelcontextprotocol/sdk` 1.0.4 |
| UI | Svelte 5.17 inside the Obsidian plugin (patched — see `patches/svelte@5.16.0.patch`) |
| Reactive deps | RxJS 7.8 (for polling other Obsidian plugins until loaded) |
| HTML→Markdown | Turndown 7.2 |
| Test | `bun:test` (native) |
| Format | Prettier 3 (`.prettierrc.yaml`) — 2-space indent, 80 col |
| Build | `bun build --compile` for the server binary, custom `bun.config.ts` for the plugin |
| CI | GitHub Actions (`.github/workflows/release.yml`) — cross-platform binaries + SLSA provenance |

Path alias inside every package: **`$/*` → `src/*`**. Use it instead of relative imports across feature boundaries.

## Commands

All commands run from the repo root unless noted. Bun workspaces use `bun --filter '*' <task>` to fan out to every package that defines the task.

```bash
bun install                           # Install all workspace dependencies
bun run check                         # Type-check every package (tsc --noEmit)
bun run dev                           # Watch all packages in parallel
bun run release                       # Build every package for release (cross-platform)
bun run zip                           # Produce plugin release artifact zip
bun run version [patch|minor|major]   # Bump version atomically across
                                      # package.json, manifest.json, versions.json
                                      # then commit, tag, and push
```

Per-package highlights (see each package's `package.json` for the full list):

```bash
# packages/mcp-server
bun run dev            # watch + compile → ../../bin/mcp-server
bun run build          # single-platform binary → dist/mcp-server
bun run build:mac-arm64 | :mac-x64 | :linux | :windows
bun run inspector      # @modelcontextprotocol/inspector against src/index.ts
                       # PRIMARY DEBUGGING TOOL — use it to verify tool schemas
bun test               # bun test ./src/**/*.test.ts

# packages/obsidian-plugin
bun run dev            # custom bun.config.ts watch build → main.js + styles.css at package root
bun run build          # prod build
bun run link           # symlink the built plugin into a local Obsidian vault (scripts/link.ts)
bun run zip            # release artifact
```

## Architecture

### Monorepo layout

```
obsidian-mcp-tools/
├── packages/
│   ├── mcp-server/          # Standalone MCP server → compiled binary
│   ├── obsidian-plugin/     # Obsidian plugin (TS + Svelte 5)
│   ├── shared/              # ArkType schemas, logger, cross-package types
│   └── test-site/           # SvelteKit test harness (marginal, not required for core dev)
├── docs/
│   ├── project-architecture.md
│   ├── migration-plan.md
│   └── features/
│       ├── mcp-server-install.md      # Installer flow spec
│       └── prompt-requirements.md
├── scripts/version.ts       # Atomic version bump across package.json/manifest/versions
├── patches/svelte@5.16.0.patch
├── .github/
│   ├── workflows/release.yml          # Tag-triggered cross-platform build + SLSA attestation
│   ├── ISSUE_TEMPLATE/                # bug_report, feature_request, question
│   └── pull_request_template.md
├── .clinerules              # Authoritative architecture contract — READ THIS
├── manifest.json            # Project-level manifest (mirror of plugin manifest)
├── versions.json            # plugin-version → min Obsidian version mapping
└── bun.lock
```

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
- **Boolean parameters arrive as strings** (`"true"`/`"false"`) from the MCP SDK — `ToolRegistry` handles coercion centrally. Do not re-implement it per tool; see `templates/index.ts` for an explicit `type("'true'|'false'")` workaround.
- Validate every untrusted JSON payload with ArkType first. The idiomatic pattern is the **pipeline form**: `type("string.json.parse").pipe(schema)` — parses and validates in one expression. Use `.to()` to chain further transformations.
- **`ToolRegistry` is the only sanctioned way** to register tools and prompts. New features must plug into it — do not register raw MCP handlers against the SDK directly, even for one-off cases. This is how boolean coercion, error formatting, and logging stay uniform across tools.

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
| `execute_obsidian_command` | Gated execution. Every call goes through a rate limiter (100/minute tumbling window) and then the plugin's `/mcp-tools/command-permission/` endpoint, which checks the master toggle + per-command allowlist. Disabled by default. |

### Prompts

Prompts are **dynamically discovered** from the vault, not hardcoded — see `features/prompts/index.ts`:

- Source directory: `Prompts/` at the vault root.
- A file becomes an MCP prompt only if it has the tag `#mcp-tools-prompt`.
- Prompt arguments are parsed from Templater template syntax in the file body (`parseTemplateParameters`).
- On `GetPrompt`, the server runs the template through `/templates/execute` (Templater plugin), strips frontmatter, and returns the result as a user message.

This means prompt schemas are **runtime data**: they depend on the user's vault contents and change when they edit a prompt note.

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
- **Feature name kebab-case** (`mcp-server-install`), **function camelCase**, **type PascalCase**, **constant SCREAMING_SNAKE_CASE**.

## Gotchas

- **`patches/svelte@5.16.0.patch`** forces Svelte to use `index-client.js` instead of `index-server.js` — required for Bun bundler compatibility. Re-verify if you upgrade Svelte.
- **Self-signed HTTPS**: the server sets `process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"` inside `makeRequest.ts`. Removing or relocating this breaks every server→Obsidian call.
- **`packages/mcp-server/dist/`** is gitignored — CI (re)generates the binaries on tagged releases and publishes them as GitHub release artifacts. You can run `bun run build` locally to produce `dist/mcp-server` for development, or the cross-target scripts (`build:mac-arm64`, `build:mac-x64`, `build:linux`, `build:windows`) to produce the per-target binaries, but those files are never committed. (A previous version of this file claimed `dist/` was committed — verified false as of `1582fb4`.)
- **Version bumps must go through `bun run version`** — it atomically updates three files (`package.json`, `manifest.json`, `versions.json`) and creates the git commit + tag. Manual edits get out of sync.
- **`packages/obsidian-plugin/main.js` is written at the package root, not `dist/`** — Obsidian expects that path. Do not move it.
- **External modules in `bun.config.ts`** (`obsidian`, `@codemirror/*`, `@lezer/*`) must stay external. Bundling them breaks the plugin on load.
- **Version macro** in `features/version/index.ts` uses Bun's `with { type: "macro" }` / `with { type: "json" }` import attribute — works on Bun's compile path, will break under plain tsc emit.
- **Smart Connections compatibility**: the plugin wrapper handles both v2.x (`window.SmartSearch`) and v3.0+ (`smartEnv.smart_sources`). Preserve both code paths when modifying.
- **`execute_template.createFile`** is typed as the string `"true"|"false"` (not boolean) because the MCP client serializes booleans as strings — explicit workaround in `features/templates/index.ts`.
- **[FORK: FIXED in `d75e493`]** **`patch_vault_file` silently corrupts content with nested headings** (confirmed bug — issues #30, #71). Root cause (analysis by @doodlepip on Discord, verified):
  - The upstream `markdown-patch` library indexes headings by their full hierarchical path using a unit separator: `# Top Level` → key `"Top Level"`, `## Section A` → key `"Top Level::Section A"`.
  - The server forwards `target: "Section A"` verbatim, which does not match any key.
  - Because the server always sends `Create-Target-If-Missing: true`, a **new heading is silently appended at EOF** instead of returning an error.
  - Rule of thumb: H1 headings work with just their name; H2+ require the full path from the H1 ancestor (`"Top Level::Section A"`).
  - The fix requires either (a) agent-controlled `Create-Target-If-Missing` (PR #72) or (b) a `resolveHeadingPath` helper in the MCP plugin that expands partial names before calling the API (see Jason Bates fork, commit `8adb7dd` — never submitted upstream).
- **[FORK: FIXED in `d75e493`]** **`patch_vault_file` fails with non-ASCII headings** (e.g., Japanese) because the `Target` HTTP header is not URL-encoded. Fix proposed in PR #69 and PR #48 — not merged upstream, but the fork's cluster A commit includes URL encoding of the target header.
- **[FORK: FIXED in `04765b9`]** **Hardcoded port `27124`**: the server ignores `OBSIDIAN_API_URL` and any custom-port env var (issues #66, #67, #40). `OBSIDIAN_HOST` was added in v0.2.26 but only covers the host portion, not the port. Three competing fix PRs exist (#74, #64, #56) — none merged upstream. The fork's cluster C commit adds `OBSIDIAN_PORT` env var, `OBSIDIAN_USE_HTTP` toggle, and a `--port <n>` CLI flag (CLI flag wins over env var).
- **[FORK: FIXED in `92b233c`]** **Incompatible with Local REST API plugin v3.4.x** (issue #68, confirmed 2026-02). The v3.x root response dropped `apiExtensions` and `certificateInfo`, which the ArkType schema in this project still requires — triggers a validation error on startup. PR #55 adds version detection but is not merged upstream. The fork's cluster B commit relaxes the schema to accept the v3.4.x root response shape.
- **[FORK: FIXED in `becd3c8`]** **`resolveSymlinks` returns a relative path in the ENOENT fallback branch** (status.ts). When the server binary is not yet installed, `fsp.realpath` throws ENOENT and the fallback recomposes segments with `path.join(...resolvedParts)` where the first element is an empty string — which `path.join` silently drops, producing a relative-looking `"private/var/.../bin/mcp-server"`. Downstream, `ensureDirectory(installPath.dir)` in `installMcpServer` would then `mkdir` relative to the Obsidian process CWD instead of under the vault. Fix: prepend `path.sep` when the first resolved segment is `""` and the joined result does not already start with the separator. Regression guard: `status.integration.test.ts` → `"returns 'not installed' when the binary is missing"`.
- **[FORK: FIXED in `becd3c8`]** **`uninstallServer` throws on a never-installed vault** (uninstall.ts). The catch block around `fsp.rmdir(binDir)` only tolerated `ENOTEMPTY`, so calling uninstall on a vault that never ran "Install Server" — a legitimate flow the settings UI uses to reset state after a failed install — threw `Failed to uninstall server: ENOENT ...`. Widened the catch to tolerate both `ENOTEMPTY` and `ENOENT`.
- **[FORK: FIXED in `0f13451`]** **`uninstallServer` config cleanup is macOS-only** (uninstall.ts). The Claude Desktop config path was built with a literal `path.join(HOME, "Library/Application Support/Claude/claude_desktop_config.json")` instead of reusing the platform-aware `getConfigPath()` from `config.ts`. On Linux and Windows, the read would ENOENT (since the file lives elsewhere), silently leaving an orphan `obsidian-mcp-tools` entry in the real config. Fix: `getConfigPath()` is now exported from `config.ts` and reused by `uninstall.ts`.
- **[FORK: FIXED in `2c482a6`]** **`shared/src/types/plugin-templater.ts` broke every `mcp-server` compile build.** The file imported `App`, `TAbstractFile`, `TFile`, `TFolder` from `"obsidian"` as value imports, even though every usage was type-only (interface fields, parameter types, return types). Under `verbatimModuleSyntax: true`, `tsc` preserved the import in the emit; `bun build --compile` then tried to resolve `"obsidian"` at bundle time and failed with `Could not resolve "obsidian". Maybe you need to "bun install"?` — the npm `obsidian` package ships only `.d.ts` files, since Obsidian itself injects the module at plugin load. The bug had been latent since `354cce8 refactor: move plugins and types around`; local `bun run build` and every `bun run build:mac-arm64|mac-x64|linux|windows` failed identically, and the release.yml CI workflow would have failed on the next tag push. Fix: one-line change to `import type { … }`, which elides the whole import from the emit. Verified: all 5 targets build cleanly; 409 modules bundled; output sizes 60-112 MB per target. **Rule**: every `from "obsidian"` import in `packages/shared/` must be `import type`. The `packages/obsidian-plugin/` package is fine — Obsidian injects the runtime module at plugin load time, so value imports there are legitimate.

## Testing & CI

- Framework: `bun:test` (`import { describe, expect, test } from "bun:test"`).
- Tests live next to the code (`*.test.ts`).
- **Counts as of 2026-04-11 fork state**: `mcp-server` 93 pass / 8 files; `obsidian-plugin` 120 pass / 8 files. Total **213 pass**.
- Run a single file: `bun test src/features/fetch/services/markdown.test.ts`. Run a whole package: `cd packages/<name> && bun test`. Run check + tests across all packages: `bun run check` from the repo root, then `bun test` in each package (there is no monorepo-wide `bun test` fan-out today).
- **Plugin test infrastructure** (added in the fork):
  - `packages/obsidian-plugin/bunfig.toml` — `[test] preload` registers a synthetic `"obsidian"` module via `src/test-setup.ts`, so test files can import production modules that reference `Plugin`, `Notice`, `FileSystemAdapter`, `TFile`, etc. The real npm `obsidian` package ships only `.d.ts` files; at production runtime Obsidian injects the module itself. Without this preload, any plugin test that transitively imports a file referencing those classes crashes at load with `Cannot find package 'obsidian'`.
  - `packages/obsidian-plugin/src/test-setup.ts` — the module mock. `FileSystemAdapter` accepts an optional `basePath` constructor argument so tests can anchor the fake vault at a real temp directory (`new FileSystemAdapter(tmpRoot)`). Production code never constructs a `FileSystemAdapter` itself — Obsidian does via `plugin.app.vault.adapter` — so the extra parameter is invisible to the ship build.
  - `packages/obsidian-plugin/.env.test` — provides fake `GITHUB_DOWNLOAD_URL` and `GITHUB_REF_NAME` so the build-time `environmentVariables()` macro in `constants/bundle-time.ts` succeeds when `install.ts` is transitively loaded from a test context. Bun loads this file automatically when `bun test` runs (it sets `NODE_ENV=test`).
  - **Stubbing `os.homedir()`**: tests that need to relocate a platform-specific config path (e.g. macOS `~/Library/Application Support/Claude/…`) use `spyOn(os, "homedir").mockReturnValue(tmpRoot)`. Bun/Node cache HOME early, so a runtime `process.env.HOME = …` override is not reliable. See `config.test.ts` and `uninstall.test.ts` for the pattern.
  - **Integration tests for the installer state machine** use real shell scripts as fake binaries (written to a tmpdir with `mode: 0o755`) instead of mocking `child_process.exec`. This keeps the test one step closer to reality and exercises `semver.clean` on actual stdout. See `status.integration.test.ts`. Tests are macOS-guarded (the shebang approach is Unix-only).
- **Covered on the plugin side** (as of fork 2026-04-11):
  - Pure helpers: `pathSegments.ts`, `constants/paths.ts`, `tool-toggle/utils.ts`
  - `services/config.ts` — `updateClaudeConfig` + `removeFromClaudeConfig` (9 tests)
  - `services/install.ts` — `getDownloadUrl`, `getPlatform`, `getArch`, `ensureDirectory` (10 tests)
  - `services/status.ts` — `getInstallationStatus` state machine (9 tests)
  - `services/uninstall.ts` — `uninstallServer` flow (6 tests)
- **Still not covered on the plugin side**: `installMcpServer` (orchestration wrapper), `downloadFile` (HTTP + stream; would need a local test server or a heavy `https.get` mock), and **no Svelte component rendering tests** — the existing Svelte files are covered only by `svelte-check` (static) and manual `bun run link` smoke tests.
- CI: `.github/workflows/release.yml` triggers on tag push, runs `bun run release`, cross-compiles all platforms, generates SLSA provenance attestations, and uploads release artifacts. **No test step in CI yet** — tests run locally only, so keep them green before every merge to `myfork/main`.

## Pre-commit checklist

Run these in order. Type checking and tests verify code correctness; the inspector verifies **feature** correctness — do not skip it for server changes.

**For any change:**

1. **`bun run check`** (at the repo root) — TypeScript strict check across all packages. Must pass.
2. **Never bump version fields by hand.** Use `bun run version [patch|minor|major]` which atomically updates `package.json`, `manifest.json`, and `versions.json`, commits, and tags.

**For changes in `packages/mcp-server/`:**

3. **`bun test`** — existing tests must pass. Add tests whenever you touch parsing or conversion logic.
4. **`bun run inspector`** — primary debugging tool. Launches `@modelcontextprotocol/inspector` against the server source and lets you verify that new or modified tools register correctly, expose the expected schema, and return well-formed MCP results.

**For changes in `packages/obsidian-plugin/`:**

3. **`bun run build`** (from the package) — a clean prod build must succeed.
4. **Manual integration test** — `bun run link` into a throwaway Obsidian vault, enable the plugin, then verify: server install flow, Claude Desktop config write, REST endpoint registration, settings UI. Type checks do not catch UI or install-flow regressions.

**For changes in `packages/shared/`:**

3. **`bun run check` at the repo root** (again) — shared-package changes cascade to both runtime packages; both must still type-check after the change.

## Project status

**Snapshot date: 2026-04-11.** Sources: repository code + git log + official docs + Discord #maintainers channel (21 messages, 2025-07-13 → 2026-03-20) + GitHub Issues/PRs via public REST API.

### Maintainership: effectively dormant

- **`jacksteamdev` stated on 2025-07-23** (Discord): *"I have limited time to make major contributions, but I'm happy to talk things through and review PRs."* The call for maintainers in the README closed 2025-09-30.
- **As of 2026-03-20** (Discord), @Jack-Pines-Blacksmith asked if new maintainers had been selected. **No answer was posted.** No new maintainer appears in commits or PR merges.
- **Merge activity**: the last merged PR on `main` is in the 0.2.26 → 0.2.27 window. Since then, **23 issues and 23 PRs have accumulated open** with no merges.
- **Critical pattern**: on **2025-11-15** a single contributor (`vanmarkic`) opened **13 PRs** back-to-back with branch names `claude/fix-issue-XX-...` — clearly a Claude Code automation batch covering most of the open issues at that time. **None have been merged** (still open at this snapshot). This is the clearest evidence that automated community contributions are not being processed.

**Implication for anyone working in this codebase**: treat the upstream as frozen. If you need a fix, expect to fork or cherry-pick unmerged PRs.

### Static analysis findings (from code + config)

- **[UPDATED IN FORK 2026-04-11]** **Test coverage improved significantly**: the server has 88 tests across 7 files; the plugin has 66 tests across 7 files (154 total). Installer state machine, config writer, `get_vault_file` binary detection, tool-toggle helpers, and multiple legacy bugs now have regression guards. Svelte component rendering is still uncovered — see "Testing & CI" above for the rationale.
- **[FORK: FIXED in `7e95366`]** **Dual validators**: both `arktype` and `zod` were server dependencies. ArkType is the project standard per `.clinerules`; `zod` was confirmed unused by a repo-wide grep and removed in the fork.
- **[FORK: UPDATED]** **MCP SDK**: the fork runs on `@modelcontextprotocol/sdk@1.29.0` (upstream is still on `1.0.4`). The upgrade was applied in a single commit and required **zero code changes** — the SDK's public surface (`Server`, `StdioServerTransport`, `McpError`, `ErrorCode`, `CallToolRequestSchema`, `ListToolsRequestSchema`, `GetPromptRequestSchema`, `Result`) stayed backward-compatible across 29 minor releases. The `ToolRegistry.coerceBooleanParams` workaround is no longer strictly necessary (modern clients send booleans as real JSON booleans, not strings) but it is kept in place because it is idempotent and protects against older MCP clients that may still be in the wild. The explicit `type("'true'|'false'")` workaround in `features/templates/index.ts` is in the same category.
- **[FORK: FIXED]** **`cline_docs/` directory**: referenced in `.clinerules` for task records. Previously missing from the tree — now created with a README (`cline_docs/README.md`) documenting the intended workflow (task lifecycle: create → update → summarize). Using the directory is optional; the fork's recent work has been tracked through `git log` + this CLAUDE.md snapshot rather than per-task records, but the directory now exists so the `.clinerules` reference is no longer dangling.
- **Stale branches on origin**: `feat--example-website-for-testing`, `feat--source-documents`, `feat--update-plugin-manifest`, `feature--search-and-list-tags`, `fix--use-obsidian-platform-api`, `refactor--rebrand` — none merged, some likely abandoned.
- **Plugin `.eslintrc` uses legacy ESLint 5.29** — no root linter configured, only this local one. No Biome anywhere.
- **No `.env.example`** — the only documented env var is `OBSIDIAN_API_KEY`, which the plugin sets automatically by reading it out of the Local REST API plugin settings.
- **`test-site` package** is a SvelteKit harness and is not part of the shipped product — safe to ignore unless you are actively using it.

## Open issues & PRs snapshot (2026-04-11)

23 open issues + 23 open PRs **upstream**. Grouped by cluster so you can plan a merge/cherry-pick strategy. Only the most load-bearing items are listed; see GitHub for the full list.

> **Reading key**: ✅ = **closed in the `istefox` fork** at the commit SHA shown — still open on `jacksteamdev/main`. Anything without ✅ is open on both upstream and the fork.

### Cluster A — `patch_vault_file` (highest impact) ✅ `d75e493`

| Ref | Title | Status |
|---|---|---|
| Issue #71 | `patch_vault_file` silently corrupts content when targeting nested headings | Root cause analyzed on Discord by @doodlepip — see Gotchas above |
| Issue #30 | `patch_vault_file` issues (8 comments, most discussed) | Open since 2025-08 |
| PR #72 | fix: replace hardcoded `Create-Target-If-Missing` with agent-controlled option | Addresses #71 |
| PR #69 | fix: URL-encode `Target` header for non-ASCII heading names | Addresses the Japanese bug raised by @らすかる on Discord |
| PR #48 | fix: encode HTTP headers in patch operations | Overlaps PR #69 |
| External fork | Jason Bates `obsidian-mcp-tools` commit `8adb7dd` — `resolveHeadingPath` helper for partial H2+ names | **Never submitted as PR** |

### Cluster B — Local REST API v3.4.x compatibility ✅ `92b233c`

| Ref | Title |
|---|---|
| Issue #68 | v0.2.27 incompatible with Local REST API v3.4.x — missing `apiExtensions` / `certificateInfo` in root response |
| PR #55 | fix: add version check and error handling for Local REST API endpoints |

### Cluster C — Hardcoded port `27124` (3 issues + 3 competing PRs) ✅ `04765b9`

| Ref | Title |
|---|---|
| Issue #67 | MCP Server binary hardcoded to port 27124 |
| Issue #66 | `OBSIDIAN_API_URL` env var is ignored |
| Issue #40 | Feature request — custom HTTP/HTTPS port env vars (raised by @davibusanello on Discord) |
| PR #74 | fix: support configurable Local REST API port |
| PR #64 | feat: support `OBSIDIAN_REST_API_PORT` env var |
| PR #56 | feat: custom HTTP/HTTPS ports via env vars |

**Editorial decision required**: three PRs solve the same problem three different ways. Pick one convention before merging.

### Cluster D — Schema compatibility with non-Claude MCP clients ✅ `700274c`

| Ref | Title |
|---|---|
| Issue #63 | `inputSchema` uses `additionalProperties: {}` — breaks **Letta Cloud** validation |
| Issue #33 | 404 errors and schema validation issues |
| PR #70 | fix: ensure `inputSchema` always includes `properties` key for **OpenAI-compatible clients** |
| PR #50 | fix: replace `Record<string, unknown>` with empty object schema for no-arg tools |

### Cluster E — Linux / path resolution bugs (installer) ✅ `67637f4`

| Ref | Title |
|---|---|
| Issue #36 | Download Path contains duplicate `/home/<user>` |
| Issue #37 | Trailing slash on paths causes HTTP 500 |
| Issue #31 | Installer silently fails on Arch-Linux / EndeavourOS |
| PR #75 | fix: check POSIX absolute path before Win32 in `resolveSymlinks` |
| PR #53 | fix: normalize paths to prevent double slashes |
| PR #52 | fix: remove duplicate path segments after symlink resolution |
| PR #49 | fix: correct Claude Desktop config path for Linux |

### Cluster F — Smart Search / Templater failures ✅ `0b39524`

| Ref | Title |
|---|---|
| Issue #39 | `search_vault_smart` returns 404 on `POST /search/smart` |
| Issue #41 | `execute_template` fails when frontmatter lacks a `tags` field |
| PR #57 | fix: make `frontmatter.tags` optional in template execution |

### Cluster G — Feature requests (enhancements)

| Ref | Title | Fork status |
|---|---|---|
| Issue #62 | Add `limit` parameter to `search_vault_simple` | ✅ `539e115` |
| Issue #61 | Allow enabling/disabling individual MCP tools | ✅ `7ba5f3a` (server) + `7733bd8` (plugin UI) |
| Issue #60 | Documentation/support for Claude Code (CLI) | ✅ `aa1697a` |
| Issue #59 | `getVaultFile()` cannot fetch audio files | ✅ `f6d004a` |
| Issue #35 | Clarify instructions for non-Claude clients | ✅ `aa1697a` |
| Issue #29 | Obsidian command execution support | ✅ **Fase 1 + Fase 2**. Fase 1 (`c2f4549`): deny-by-default allowlist model, two MCP tools, plugin endpoint, server-side hard rate limiter (100/min), audit log ring buffer, settings UI with live command browser. Fase 2 (this branch): long-polling confirmation modal for one-off commands via `CommandPermissionModal` + `CommandPermissionPrompt.svelte`; three-button decision flow (Allow once / Allow always / Deny) with 30s timeout; destructive-command heuristic (disables "Allow always" for ids/names matching `/\b(delete\|remove\|…)\b/i`); soft rate-limit warning at 30/min via a plugin-side runtime counter. Fase 3 (categorized presets, modal unit tests, CSV export of audit log) still open. |
| Issue #28 | Install MCP server outside of vault | ✅ `4552c18` (backend) + `ce8a4bd` (UI) — new default is a system path (`~/Library/Application Support/obsidian-mcp-tools/bin` on macOS, `~/.local/share/obsidian-mcp-tools/bin` on Linux, `%APPDATA%\obsidian-mcp-tools\bin` on Windows); legacy "Inside vault" opt-in preserved via plugin settings; existing users get a migration banner with a one-click confirmation dialog that downloads the new binary, rewrites the client config, and removes the old vault binary. Rollback-on-failure keeps state safe if the download dies mid-flight. New backend APIs: `detectLegacyVaultBinary()` and `migrateFromVaultToSystem()`. |
| Issue #26 | Select which platform for the server binary (WSL) | ✅ `2121ecf` — server install reads `OBSIDIAN_SERVER_PLATFORM`/`OBSIDIAN_SERVER_ARCH` env vars **and** a `platformOverride` plugin setting (Advanced section in settings UI). getPlatform/getArch now accept an optional override argument; call sites read it from `plugin.loadData()`. Banner in the settings UI warns when the installed binary does not match the selected platform. |
| PR #65 | feat: improve tool schema clarity for better LLM reliability | open |
| PR #47 | feat: add Obsidian command execution via MCP tools (addresses #29) | open — gated on #29 design review |

### Cluster H — Stale / ambitious PRs

| Ref | Title |
|---|---|
| PR #44 | **OAuth** support (2025-10-16) |
| PR #20 | **Multiple vaults** support (2025-05-25 — ~1 year stale) |
| PR #58 | Integration testing suite via osascript automation |
| PR #46, #51, #54 | Docs PRs from the vanmarkic batch — low-risk, easy merges |

## Suggested next steps (for whoever picks up active work)

**Ordered by impact and urgency.** Fork-and-rebrand stance is in force because upstream is dormant. Items marked ✅ have been landed on `myfork/main` since the original roadmap was written; check the commit SHA before assuming any of them still need work.

1. **Decide the maintainership stance first.** If contributing upstream, open a GitHub discussion to gauge whether jacksteamdev will review PRs in batches. If forking permanently, rename the package, change `manifest.json` → `id`, and make it clear the fork is independent. Do not start merging community PRs upstream without owner buy-in — `.clinerules` and the commit history suggest the owner has specific preferences that are not all documented. **Status**: unresolved; the fork continues to work under the original `obsidian-mcp-tools` id and `jacksteamdev` owner string.
2. ✅ **`patch_vault_file` fix bundle** (Cluster A) — `d75e493`.
3. ✅ **Local REST API v3.4.x compatibility break** (Cluster B, issue #68) — `92b233c`.
4. ✅ **Port configurability** (Cluster C) — `04765b9`. The fork picked the `OBSIDIAN_PORT` env var + `--port` CLI flag approach, with `OBSIDIAN_HOST` retained for host-only overrides. The three competing upstream PRs (#74, #64, #56) are superseded.
5. ✅ **Schema shape for non-Claude clients** (Cluster D) — `700274c`.
6. ✅ **Linux path bugs** (Cluster E) — `67637f4`.
7. ✅ **Plugin tests for the installer state machine** — `1d94b64` (`config` + `install` helpers) and `becd3c8` (`getInstallationStatus` + `uninstallServer` with two production bug fixes uncovered along the way: `resolveSymlinks` ENOENT fallback returning a relative path, and `uninstallServer` throwing on ENOENT during rmdir). Follow-up `0f13451` shared `getConfigPath` between `config.ts` and `uninstall.ts` to fix the cross-platform Claude config cleanup bug.
8. ✅ **Upgrade `@modelcontextprotocol/sdk`** — landed in a single bump from `1.0.4` to `1.29.0`. Turned out to be **zero code changes**: the SDK maintained backward compat across 29 minor releases, and a stdio integration test (initialize + notifications/initialized + tools/list + tools/call on `fetch` with a boolean arg) confirmed the 18-tool surface works end-to-end against the new SDK without any regressions. `ToolRegistry.coerceBooleanParams` and the explicit `type("'true'|'false'")` in `features/templates/index.ts` are retained as belt-and-suspenders for older MCP clients. **Open follow-up**: `get_vault_file`'s binary-file short-circuit (commit `f6d004a`) can now be replaced with a real audio/image content-type response since SDK 1.29.0 supports them natively. Not included in this bump to keep the blast radius small — tracked as a separate future enhancement.
9. ✅ **Remove `zod`** — `7e95366`. Confirmed unused, removed from `packages/mcp-server/package.json` and `bun.lock`.
10. ✅ **Create `cline_docs/`** — landed as a docs-only commit. Directory created with `cline_docs/README.md` documenting the intended task-record lifecycle from `.clinerules`. Using the directory is optional; if a future session wants to adopt the per-task-record workflow, drop a new markdown file in.
11. **Prune stale remote branches** on `origin` (`feat--example-website-for-testing`, `feat--source-documents`, `refactor--rebrand`, …). These belong to the upstream remote — the fork cannot delete them. Only relevant if maintainership migrates. **Not yet started.**
12. ✅ **Document the prompt system end-to-end** — the obsolete `docs/features/prompt-requirements.md` (a pre-implementation planning doc) has been replaced by a new authoritative reference at `docs/features/prompt-system.md` covering the vault-side contract (folder name, tag forms, frontmatter schema), the Templater parameter parser rules, the discovery and execution flows, and known limitations. README.md now has a user-facing "Using prompts" section with a 60-second quickstart, an example prompt body, and a pointer to the full reference.

### Still pending from Cluster G

- **PR #47 / Issue #29** (Obsidian command execution via MCP) — **Fase 1 + Fase 2 landed**. The fork diverges from upstream PR #47 and adopts the Option F hybrid (allowlist + per-invocation confirmation prompt). Fase 1 (`c2f4549`) added the deny-by-default allowlist, audit log ring buffer, hard rate limiter, and settings UI. Fase 2 added the long-polling confirmation modal so the agent can ask for one-off permission (`CommandPermissionModal` in Svelte, 30s HTTP timeout, three-button flow, destructive-word heuristic, soft rate-limit warning at 30/min). Only **Fase 3** remains: categorized presets, automated tests for the modal flow (spy-based, since Modal requires a live Obsidian runtime), configurable rate limits via hidden settings, and CSV export of the audit log from the settings UI. Fase 3 is a polish pass — the feature is complete and usable as of Fase 2. Re-read `docs/design/issue-29-command-execution.md` before picking up Fase 3.

### Also pending from the fork's own discoveries

- **Legacy installer bug deep-dive** is now closed (steps 7 + follow-up). No remaining known installer bugs.
- **Update CLAUDE.md** — this document has been refreshed as of 2026-04-11 to reflect the fork's state. Keep it current by re-running the Open issues snapshot and the Testing counts at each significant commit.

## References

**In-repo docs** (read these before implementing a new feature):

- `.clinerules` — authoritative feature architecture, ArkType conventions, error handling contract.
- `docs/project-architecture.md` — monorepo overview (aligned with `.clinerules`).
- `docs/features/mcp-server-install.md` — installer feature spec (install flow, settings UI, Claude config writes, version management, error handling, uninstall).
- `docs/features/prompt-system.md` — authoritative reference for the prompt feature: vault-side contract (folder, tags, frontmatter), Templater parameter syntax, discovery and execution flows, known limitations. Read this before touching `packages/mcp-server/src/features/prompts/` or the template execution endpoint in the plugin. Replaces the earlier `prompt-requirements.md` planning doc.
- `docs/design/issue-29-command-execution.md` — fork design review for Obsidian command execution (threat model, policy options, MCP tool surface, phased implementation plan). Authoritative reference when issue #29 / PR #47 is picked up.
- `CONTRIBUTING.md` — community standards + release process.
- `SECURITY.md` — SLSA provenance, vulnerability reporting (`jacksteamdev+security@gmail.com`).

**Live project state**:

- [Open issues](https://github.com/jacksteamdev/obsidian-mcp-tools/issues) / [Open PRs](https://github.com/jacksteamdev/obsidian-mcp-tools/pulls) — the "Open issues & PRs snapshot" section above is frozen at 2026-04-11; always cross-check GitHub for anything landed since.
- Discord `#maintainers` channel (server invite in README) — low traffic but contains the root-cause analysis for `patch_vault_file` and the open maintainership question.
- [Jason Bates fork](https://github.com/JasonBates/obsidian-mcp-tools), commit [`8adb7dd`](https://github.com/JasonBates/obsidian-mcp-tools/commit/8adb7dd0e1c47081f15908950b89e96b7417d12a) — unsubmitted `resolveHeadingPath` fix for `patch_vault_file` nested-heading bug. Cherry-pick source of truth.

**Upstream dependencies worth knowing**:

- [Model Context Protocol spec](https://modelcontextprotocol.io) — for boolean/schema shape gotchas.
- [Obsidian Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) — the HTTPS bridge this server depends on. Changes in v3.x are the source of Cluster B compatibility breaks.
- [Local REST API OpenAPI reference](https://coddingtonbear.github.io/obsidian-local-rest-api/) — especially the `PATCH /vault/{filename}` section, whose header-based request format is famously hard to generate correctly.
- Alternative file-editing approaches referenced by jacksteamdev as possible replacements for the PATCH-REST approach: [Desktop Commander MCP `edit.ts`](https://github.com/wonderwhy-er/DesktopCommanderMCP/blob/main/src/tools/edit.ts) (find & replace), [Cline](https://cline.bot) (diff-based edits).
