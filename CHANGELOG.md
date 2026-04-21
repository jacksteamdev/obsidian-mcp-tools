# Changelog

All notable changes to **MCP Connector** (formerly `obsidian-mcp-tools`) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).

## [0.3.3] — 2026-04-21

### Added
- `OBSIDIAN_API_URL` env var support as a convenience alias that
  parses into host / port / protocol. The more specific
  `OBSIDIAN_HOST`, `OBSIDIAN_PORT` and `OBSIDIAN_USE_HTTP` variables
  still take precedence when set, preserving drop-in compatibility
  with upstream v0.2.x configurations. Fixes upstream issue #66.

### Fixed
- `normalizeInputSchema` now strips `additionalProperties: {}` (the
  empty-object form emitted by some schema generators), which
  strict MCP validators such as Letta Cloud reject with a 500.
  `additionalProperties: true`, `false`, and genuine sub-schemas are
  left untouched. Fixes upstream issue #63.
- `makeRequest` collapses consecutive slashes in request paths, so a
  caller-supplied directory with a trailing slash (`"DevOps/"`) no
  longer produces `/vault/DevOps//` and the subsequent 404 from the
  Local REST API. Fixes upstream issue #37.

## [0.3.2] — 2026-04-17

### Changed
- Migrated the MCP server from the deprecated `Server` class to `McpServer` (SDK 1.29.0 high-level API). The underlying `Server` is still reachable via `McpServer.server` for the low-level `setRequestHandler` routing used by the custom `ToolRegistry`.
- Sentence-case pass on user-facing `Notice` text.

### Fixed
- Lint pass over the `ObsidianReviewBot` findings across all three packages (plugin, shared, MCP server):
  - typed error stringification (`error instanceof Error ? error.message : String(error)`) on every template-literal fallback;
  - `void`-prefixed fire-and-forget Svelte `mount`/`unmount` and `bun:test` `mock.module` calls;
  - removed useless `async` on `setup()` helpers and `getLocalRestApiKey`; added `.catch()` handler on the RxJS `lastValueFrom` in `main.ts`;
  - removed `any` from the Smart Connections v2/v3 compatibility wrapper via minimal inline types (both code paths preserved);
  - replaced the workspace self-import in `packages/shared` with a relative path;
  - miscellaneous cleanups: `String.raw` regex literal, `parseInt` radix, unused catch bindings, unused imports, empty-object types tightened.

## [0.3.1] — 2026-04-13

### Fixed
- Trimmed the `manifest.json` description to satisfy community-store reviewer-bot rules (removed the `Obsidian` token, aligned with the description used in `community-plugins.json`).

## [0.3.0] — 2026-04-13

### Added
- Rebrand to **MCP Connector** (`id: mcp-tools-istefox`, author: Stefano Ferri). The fork is now publicly published as `istefox/obsidian-mcp-connector`.
- Issue #29 command-execution feature set: per-vault allowlist + confirmation modal + audit log + presets, all gated by a master toggle (disabled by default). See `docs/design/issue-29-command-execution.md` for the full threat model.
- End-user README rewrite covering installation, configuration, MCP-client compatibility, security posture, and development workflow.
- Migration guide for users switching from upstream (`docs/migration-from-upstream.md`).

### Fixed
- `bun run version <part>` now reads the semver part from the correct argv index (was always falling back to `patch`).
- Release pipeline paths corrected so the cross-platform build workflow produces the expected artifacts.
- Upstream issue #77 regression: tools with `arguments: {}` now emit `inputSchema` with an explicit `properties` key — fixes strict MCP clients such as `openai-codex`.
- Smart Connections v3 compatibility (the wrapper now handles both `window.SmartSearch` in v2.x and `env.smart_sources` in v3+).

## Earlier

Release history before the community-continuation rebrand lives in the upstream repository at
[`jacksteamdev/obsidian-mcp-tools`](https://github.com/jacksteamdev/obsidian-mcp-tools) up to `0.2.27`.

[0.3.3]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.3
[0.3.2]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.2
[0.3.1]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.1
[0.3.0]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.0
