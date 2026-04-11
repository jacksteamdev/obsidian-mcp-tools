# CLAUDE.md

Guidance for Claude Code (and similar AI agents) working in this repository.

## Project

**MCP Tools for Obsidian** — a Model Context Protocol (MCP) bridge that lets AI clients such as Claude Desktop access an Obsidian vault for reading, writing, searching (text + semantic), and executing templates, without bypassing Obsidian itself.

Two shipping components glued together by the Local REST API plugin:

1. **Obsidian plugin** — installs/updates a signed MCP server binary, writes `claude_desktop_config.json`, and exposes extra HTTP endpoints that the server calls back into (semantic search via Smart Connections, template execution via Templater).
2. **MCP server binary** — long-lived subprocess launched by Claude Desktop over stdio. Translates MCP tool/prompt calls into HTTPS requests against the Obsidian Local REST API plugin on `127.0.0.1:27124`.

Why the detour through Local REST API instead of reading `.md` files directly: it preserves Obsidian's metadata cache, respects file locks on open notes, and lets the server invoke other Obsidian plugins (Templater, Smart Connections, Dataview) through their APIs.

Current version: **0.2.27** (see root `package.json`). License: MIT.

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

### Tools (18 total)

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
- **`packages/mcp-server/dist/`** is committed — CI regenerates it on tagged releases. Do not hand-edit or delete.
- **Version bumps must go through `bun run version`** — it atomically updates three files (`package.json`, `manifest.json`, `versions.json`) and creates the git commit + tag. Manual edits get out of sync.
- **`packages/obsidian-plugin/main.js` is written at the package root, not `dist/`** — Obsidian expects that path. Do not move it.
- **External modules in `bun.config.ts`** (`obsidian`, `@codemirror/*`, `@lezer/*`) must stay external. Bundling them breaks the plugin on load.
- **Version macro** in `features/version/index.ts` uses Bun's `with { type: "macro" }` / `with { type: "json" }` import attribute — works on Bun's compile path, will break under plain tsc emit.
- **Smart Connections compatibility**: the plugin wrapper handles both v2.x (`window.SmartSearch`) and v3.0+ (`smartEnv.smart_sources`). Preserve both code paths when modifying.
- **`execute_template.createFile`** is typed as the string `"true"|"false"` (not boolean) because the MCP client serializes booleans as strings — explicit workaround in `features/templates/index.ts`.
- **`patch_vault_file` silently corrupts content with nested headings** (confirmed bug — issues #30, #71). Root cause (analysis by @doodlepip on Discord, verified):
  - The upstream `markdown-patch` library indexes headings by their full hierarchical path using a unit separator: `# Top Level` → key `"Top Level"`, `## Section A` → key `"Top Level::Section A"`.
  - The server forwards `target: "Section A"` verbatim, which does not match any key.
  - Because the server always sends `Create-Target-If-Missing: true`, a **new heading is silently appended at EOF** instead of returning an error.
  - Rule of thumb: H1 headings work with just their name; H2+ require the full path from the H1 ancestor (`"Top Level::Section A"`).
  - The fix requires either (a) agent-controlled `Create-Target-If-Missing` (PR #72) or (b) a `resolveHeadingPath` helper in the MCP plugin that expands partial names before calling the API (see Jason Bates fork, commit `8adb7dd` — never submitted upstream).
- **`patch_vault_file` fails with non-ASCII headings** (e.g., Japanese) because the `Target` HTTP header is not URL-encoded. Fix proposed in PR #69 and PR #48 — not merged.
- **Hardcoded port `27124`**: the server ignores `OBSIDIAN_API_URL` and any custom-port env var (issues #66, #67, #40). `OBSIDIAN_HOST` was added in v0.2.26 but only covers the host portion, not the port. Three competing fix PRs exist (#74, #64, #56) — none merged.
- **Incompatible with Local REST API plugin v3.4.x** (issue #68, confirmed 2026-02). The v3.x root response dropped `apiExtensions` and `certificateInfo`, which the ArkType schema in this project still requires — triggers a validation error on startup. PR #55 adds version detection but is not merged.

## Testing & CI

- Framework: `bun:test` (`import { describe, expect, test } from "bun:test"`).
- Tests live next to the code (`*.test.ts`). Only the server package has tests today: `fetch/services/markdown.test.ts`, `shared/parseTemplateParameters.test.ts`. **No tests in the plugin** — you need to verify UI/install flow manually via `bun run link` into a throwaway vault.
- Run a single file: `bun test src/features/fetch/services/markdown.test.ts`.
- CI: `.github/workflows/release.yml` triggers on tag push, runs `bun run release`, cross-compiles all platforms, generates SLSA provenance attestations, and uploads release artifacts.

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

- **Test coverage is thin**: two unit test files in the server (`fetch/services/markdown.test.ts`, `shared/parseTemplateParameters.test.ts`), zero in the plugin. `.clinerules` mandates unit + integration + E2E but reality is far behind.
- **Dual validators**: both `arktype` and `zod` are server dependencies. ArkType is the project standard per `.clinerules`; Zod presence is likely legacy — audit before removing.
- **MCP SDK pinned to `1.0.4`** — a very early version. Upgrading will probably touch every `tools.register()` call site.
- **`cline_docs/` directory is referenced in `.clinerules`** for task records but does not exist in the tree (`.gitignore` excludes `cline_docs/temp/`). Create the directory if you want to follow the Cline workflow it prescribes.
- **Stale branches on origin**: `feat--example-website-for-testing`, `feat--source-documents`, `feat--update-plugin-manifest`, `feature--search-and-list-tags`, `fix--use-obsidian-platform-api`, `refactor--rebrand` — none merged, some likely abandoned.
- **Plugin `.eslintrc` uses legacy ESLint 5.29** — no root linter configured, only this local one. No Biome anywhere.
- **No `.env.example`** — the only documented env var is `OBSIDIAN_API_KEY`, which the plugin sets automatically by reading it out of the Local REST API plugin settings.
- **`test-site` package** is a SvelteKit harness and is not part of the shipped product — safe to ignore unless you are actively using it.

## Open issues & PRs snapshot (2026-04-11)

23 open issues + 23 open PRs. Grouped by cluster so you can plan a merge/cherry-pick strategy. Only the most load-bearing items are listed; see GitHub for the full list.

### Cluster A — `patch_vault_file` (highest impact)

| Ref | Title | Status |
|---|---|---|
| Issue #71 | `patch_vault_file` silently corrupts content when targeting nested headings | Root cause analyzed on Discord by @doodlepip — see Gotchas above |
| Issue #30 | `patch_vault_file` issues (8 comments, most discussed) | Open since 2025-08 |
| PR #72 | fix: replace hardcoded `Create-Target-If-Missing` with agent-controlled option | Addresses #71 |
| PR #69 | fix: URL-encode `Target` header for non-ASCII heading names | Addresses the Japanese bug raised by @らすかる on Discord |
| PR #48 | fix: encode HTTP headers in patch operations | Overlaps PR #69 |
| External fork | Jason Bates `obsidian-mcp-tools` commit `8adb7dd` — `resolveHeadingPath` helper for partial H2+ names | **Never submitted as PR** |

### Cluster B — Local REST API v3.4.x compatibility

| Ref | Title |
|---|---|
| Issue #68 | v0.2.27 incompatible with Local REST API v3.4.x — missing `apiExtensions` / `certificateInfo` in root response |
| PR #55 | fix: add version check and error handling for Local REST API endpoints |

### Cluster C — Hardcoded port `27124` (3 issues + 3 competing PRs)

| Ref | Title |
|---|---|
| Issue #67 | MCP Server binary hardcoded to port 27124 |
| Issue #66 | `OBSIDIAN_API_URL` env var is ignored |
| Issue #40 | Feature request — custom HTTP/HTTPS port env vars (raised by @davibusanello on Discord) |
| PR #74 | fix: support configurable Local REST API port |
| PR #64 | feat: support `OBSIDIAN_REST_API_PORT` env var |
| PR #56 | feat: custom HTTP/HTTPS ports via env vars |

**Editorial decision required**: three PRs solve the same problem three different ways. Pick one convention before merging.

### Cluster D — Schema compatibility with non-Claude MCP clients

| Ref | Title |
|---|---|
| Issue #63 | `inputSchema` uses `additionalProperties: {}` — breaks **Letta Cloud** validation |
| Issue #33 | 404 errors and schema validation issues |
| PR #70 | fix: ensure `inputSchema` always includes `properties` key for **OpenAI-compatible clients** |
| PR #50 | fix: replace `Record<string, unknown>` with empty object schema for no-arg tools |

### Cluster E — Linux / path resolution bugs (installer)

| Ref | Title |
|---|---|
| Issue #36 | Download Path contains duplicate `/home/<user>` |
| Issue #37 | Trailing slash on paths causes HTTP 500 |
| Issue #31 | Installer silently fails on Arch-Linux / EndeavourOS |
| PR #75 | fix: check POSIX absolute path before Win32 in `resolveSymlinks` |
| PR #53 | fix: normalize paths to prevent double slashes |
| PR #52 | fix: remove duplicate path segments after symlink resolution |
| PR #49 | fix: correct Claude Desktop config path for Linux |

### Cluster F — Smart Search / Templater failures

| Ref | Title |
|---|---|
| Issue #39 | `search_vault_smart` returns 404 on `POST /search/smart` |
| Issue #41 | `execute_template` fails when frontmatter lacks a `tags` field |
| PR #57 | fix: make `frontmatter.tags` optional in template execution |

### Cluster G — Feature requests (enhancements)

| Ref | Title |
|---|---|
| Issue #62 | Add `limit` parameter to `search_vault_simple` |
| Issue #61 | Allow enabling/disabling individual MCP tools |
| Issue #60 | Documentation/support for Claude Code (CLI) |
| Issue #59 | `getVaultFile()` cannot fetch audio files |
| Issue #35 | Clarify instructions for non-Claude clients |
| Issue #29 | Obsidian command execution support |
| Issue #28 | Install MCP server outside of vault |
| Issue #26 | Select which platform for the server binary (WSL) |
| PR #65 | feat: improve tool schema clarity for better LLM reliability |
| PR #47 | feat: add Obsidian command execution via MCP tools (addresses #29) |

### Cluster H — Stale / ambitious PRs

| Ref | Title |
|---|---|
| PR #44 | **OAuth** support (2025-10-16) |
| PR #20 | **Multiple vaults** support (2025-05-25 — ~1 year stale) |
| PR #58 | Integration testing suite via osascript automation |
| PR #46, #51, #54 | Docs PRs from the vanmarkic batch — low-risk, easy merges |

## Suggested next steps (for whoever picks up active work)

**Ordered by impact and urgency.** Each step assumes a fork-and-rebrand stance unless upstream becomes active again.

1. **Decide the maintainership stance first.** If contributing upstream, open a GitHub discussion to gauge whether jacksteamdev will review PRs in batches. If forking, rename the package, change `manifest.json` → `id`, and make it clear the fork is independent. Do not start merging community PRs upstream without owner buy-in — `.clinerules` and the commit history suggest the owner has specific preferences that are not all documented.
2. **Land the `patch_vault_file` fix as PR bundle** (Cluster A): combine the logic of PR #72 (agent-controlled `Create-Target-If-Missing`) with PR #69 (URL-encoding non-ASCII headers) plus a `resolveHeadingPath` helper inspired by Jason Bates' fork commit `8adb7dd`. Add a `patch_vault_file.test.ts` covering H1, H2, H2 full-path, non-ASCII, and EOF-append regression cases. This is the single highest-leverage fix.
3. **Resolve the Local REST API v3.4.x compatibility break** (Cluster B, issue #68) — without this, recent Local REST API users cannot use the server at all. PR #55 is a starting point but needs a design review against what actually changed in v3.4.x.
4. **Pick one port-configurability PR** from Cluster C and close the other two with a reference to the chosen one. Preferred convention: `OBSIDIAN_HOST` already exists for host + implicit port; extending it with URL parsing (`OBSIDIAN_HOST=http://localhost:9000`) is more ergonomic than adding a second env var.
5. **Fix the schema shape for non-Claude clients** (Cluster D) — small diff, broad compatibility benefit (Letta, OpenAI-compatible tooling).
6. **Triage the Linux path bugs** (Cluster E) as a single change — they all trace back to the same installer path-resolution code and should be fixed together, not as 4 separate merges.
7. **Add plugin tests** for the installer state machine (`features/mcp-server-install/services/status.ts`, `install.ts`, `uninstall.ts`) — highest-risk unverified surface.
8. **Upgrade `@modelcontextprotocol/sdk`** from 1.0.4 to a recent version. Expect to touch every `tools.register()` call site, and possibly the boolean-coercion workaround.
9. **Remove `zod`** if a grep confirms it is unused runtime code.
10. **Create `cline_docs/`** with at least a README so the directory expected by `.clinerules` is discoverable.
11. **Prune stale remote branches** and unmerged PRs that have been superseded (many of the vanmarkic PRs likely overlap with the newer fixes in the same cluster).
12. **Document the prompt system end-to-end** — `docs/features/prompt-requirements.md` exists but the vault-side contract (`Prompts/` folder, `#mcp-tools-prompt` tag, Templater parameters) is not mentioned in the README.

## References

**In-repo docs** (read these before implementing a new feature):

- `.clinerules` — authoritative feature architecture, ArkType conventions, error handling contract.
- `docs/project-architecture.md` — monorepo overview (aligned with `.clinerules`).
- `docs/features/mcp-server-install.md` — installer feature spec (install flow, settings UI, Claude config writes, version management, error handling, uninstall).
- `docs/features/prompt-requirements.md` — prompt system requirements.
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
