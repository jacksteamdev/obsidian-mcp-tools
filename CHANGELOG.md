# Changelog

All notable changes to **MCP Connector** (formerly `obsidian-mcp-tools`) are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versioning follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `get_vault_file` now returns native MCP `image` and `audio` content
  blocks for supported binary types (PNG, JPEG, GIF, WebP, SVG, BMP,
  MP3, WAV, OGG, M4A, FLAC, AAC, WebM audio), so multimodal clients
  can render them inline instead of receiving an opaque base64 blob
  in a text response. Files above a 10 MiB inline cap, plus unsupported
  types (video, PDF, Office, archives), still get a JSON metadata
  object with the same API path / MIME fields as before, and a
  machine-readable `hint` describing why the body was not inlined.
  Builds on the 0.3.0 short-circuit for #59; lifts the text-only
  fallback now that SDK 1.29.0 ships native binary content types.

### Changed
- Widened the `ToolRegistry` result schema to accept `audio` content
  blocks alongside `text` and `image`, matching MCP SDK 1.29.0.
- Added `makeBinaryRequest` in `shared/makeRequest.ts` for the new
  binary code path — reuses the same auth and path-normalization
  layer as `makeRequest` but returns raw bytes plus the upstream
  `Content-Type` header instead of decoding as text/JSON.

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

### Changed
- Extracted `buildPatchHeaders` and `normalizeAppendBody` from the
  `patch_active_file` / `patch_vault_file` handlers as pure helpers,
  and added regression tests for the URL-encoded `Target` header
  (Cyrillic, CJK, accented + bracketed strings) and the trailing-
  newline safeguard on `append`. No behavior change — this pins
  the 0.3.0 fixes for upstream issues #30, #71, and #78 against
  accidental regression.
- Extended the regression-test pin to cover three additional 0.3.0
  fixes that were landed but never credited or test-covered:
  client-side `limit` truncation on `search_vault_simple` (#62),
  the optional `certificateInfo` / `apiExtensions` shape on the
  Local REST API root response (#68), and the optional
  `frontmatter.tags` on `ApiVaultFileResponse` that unblocks
  `execute_template` for tagless Templater templates (#41).
  Extracted `applySimpleSearchLimit` as a pure helper for symmetry
  with the other patch-handler extracts. No behavior change.
- Audit pass over the 2026-04-11 cluster commits surfaced nine
  additional upstream issues that were fixed during the 0.3.0 cut
  but never credited in the CHANGELOG: #39 (`search_vault_smart`
  Content-Type), #61 (disable individual tools via env var + UI),
  #59 (binary-file short-circuit in `get_vault_file`), #35 + #60
  (non-Claude-Desktop MCP client docs), #28 (install outside the
  vault), #26 (platform override for binary selection), #31 + #36
  (Linux installer path handling), #40 + #67 (configurable Local
  REST API port). Credit entries added below under `0.3.0 Fixed`
  with commit SHAs. No behavior change — the fixes have been in
  production since 2026-04-11.
- Added a regression pin for issue #39: the `search_vault_smart`
  tool handler now has a test asserting the explicit
  `Content-Type: application/json` header survives future refactors.
  The plugin-side `/search/smart` endpoint only parses bodies whose
  Content-Type matches `application/json`; losing the header would
  silently reintroduce the "semantic search returns no results"
  failure mode. No behavior change.

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
- `patch_active_file` / `patch_vault_file`: resolve partial heading
  names to full hierarchical paths (e.g. `"Section A"` →
  `"Top Level::Section A"`) before issuing the PATCH, preventing
  silent content corruption when the target sits under a parent
  heading. Fixes upstream issues #30 and #71. (Shipped in the
  0.3.0 cut via commit `d75e493`; credited retroactively here.)
- `patch_active_file` / `patch_vault_file`: URL-encode the `Target`
  and `Target-Delimiter` HTTP headers so non-ASCII heading names
  (Cyrillic, CJK, emoji, accented characters) survive the HTTP
  header grammar. Encoding happens after path resolution so the
  indexer lookup still matches unencoded file content. Fixes
  upstream issue #78.
- `patch_active_file` / `patch_vault_file`: append content is now
  normalized to end with `\n\n` so subsequent sections remain
  visually separated instead of colliding (e.g. `**done**## Next`).
- New `createTargetIfMissing` parameter on both patch tools lets
  callers opt into strict mode (return an explicit error instead
  of silently creating a new target at EOF when the lookup fails).
  Defaults to `true` for upstream compatibility.
- `search_vault_simple`: added an optional `limit` parameter that
  truncates the result array client-side (the underlying Local
  REST API `/search/simple/` endpoint has no native `limit` flag,
  so we slice after receiving the response). Prevents context-
  window overflow on common terms that match thousands of files,
  which otherwise forces MCP clients into the "tool result stored
  to a file" fallback and breaks conversational flow. Fixes
  upstream issue #62. (Shipped in the 0.3.0 cut via commit
  `539e115`; credited retroactively here.)
- `ApiStatusResponse`: `certificateInfo` and `apiExtensions` are
  now optional on the Local REST API `GET /` root response. The
  plugin emits them only when the caller is authenticated, so
  the MCP server's startup probe (which runs before auth is in
  place for some flows) must still accept the trimmed body —
  hard-requiring them made every MCP tool call fail with an
  ArkType validation error on Local REST API v3.4.x. Fixes
  upstream issue #68. (Shipped in the 0.3.0 cut via commit
  `92b233c`; credited retroactively here.)
- `ApiVaultFileResponse`: `frontmatter.tags` is now optional.
  Obsidian emits the `tags` key only when the note's YAML
  frontmatter actually declares one — very common for Templater
  templates and freshly-created notes to lack it. The previous
  hard requirement surfaced as `frontmatter.tags must be an
  array (was null)` and broke `execute_template` and prompt
  loading. Fixes upstream issue #41. (Shipped in the 0.3.0 cut
  via commit `0b39524`; credited retroactively here.)
- `search_vault_smart`: explicit `Content-Type: application/json`
  header on the POST to `/search/smart`. The default Content-Type
  inherited from `makeRequest` is `text/markdown` (correct for
  file-content endpoints, wrong for JSON-body endpoints); Express's
  `bodyParser.json()` only parses bodies with an `application/json`
  Content-Type, so the plugin handler was seeing an empty `req.body`
  and rejecting every semantic search. Fixes upstream issue #39.
  (Shipped in the 0.3.0 cut via commit `0b39524`; credited
  retroactively here.)
- New `OBSIDIAN_DISABLED_TOOLS` env var and plugin settings UI
  let users opt out of specific MCP tools by name (comma-separated
  list). Unknown names log warnings but do not abort startup. The
  plugin-side UI writes the env var into
  `claude_desktop_config.json` automatically so GUI-only users
  don't have to hand-edit their MCP client config. Fixes upstream
  issue #61. (Shipped in the 0.3.0 cut via commits `7ba5f3a` +
  `7733bd8`; credited retroactively here.)
- `get_vault_file` on a binary file (audio, image, video, PDF,
  Office, archive) used to crash or return UTF-8-corrupted bytes.
  It now short-circuits on binary filenames and returns a
  structured `{ kind: "binary_file", mimeType, hint }` payload
  directing the caller to `show_file_in_obsidian`. Extension-based
  detection against ~45 common binary extensions; textual formats
  (md, json, yaml, html, csv, txt, svg) remain on the normal read
  path. Fixes upstream issue #59. (Shipped in the 0.3.0 cut via
  commit `f6d004a`; credited retroactively here. Native SDK 1.29.0
  audio/image responses are a separate follow-up.)
- README documents setup for non-Claude-Desktop MCP clients
  (Claude Code, Cline, Continue, Zed, generic clients) with
  per-platform binary paths, the full env var table, and a
  generic `mcpServers` config template. Fixes upstream issues #35
  and #60. (Shipped in the 0.3.0 cut via commit `aa1697a`;
  credited retroactively here.)
- Install-location flexibility: users can now install the MCP
  server binary outside the vault (the new default, placed under
  the standard per-user application directory) or opt into the
  legacy in-vault layout. A migration banner detects existing
  in-vault binaries and offers a one-click move to the system
  path, preserving the Claude Desktop config entry. Fixes upstream
  issue #28. (Shipped in the 0.3.0 cut via commits `4552c18` +
  `ce8a4bd`; credited retroactively here.)
- Platform override for server-binary selection via an Advanced
  setting in the plugin UI and `OBSIDIAN_SERVER_PLATFORM` /
  `OBSIDIAN_SERVER_ARCH` env vars. Needed when Obsidian is running
  under WSL, Bottles, wine, or another translation layer where
  the auto-detected OS/arch does not match the client that will
  launch the binary. Invalid values fall through to auto-detect
  rather than throwing. Fixes upstream issue #26. (Shipped in the
  0.3.0 cut via commit `2121ecf`; credited retroactively here.)
- Linux installer path handling: POSIX-vs-Win32 absoluteness check
  order corrected so a leading `/` is no longer mis-identified as
  a Win32 drive root; the Claude Desktop Linux config path now
  uses the correct capital-`C` / full filename
  (`~/.config/Claude/claude_desktop_config.json`); and
  realpath-induced duplicate path segments (common on iCloud
  Drive / symlinked vault layouts) are collapsed before the
  filesystem check. Fixes upstream issues #31 and #36. (Shipped
  in the 0.3.0 cut via commit `67637f4`; credited retroactively
  here. The same commit also addressed #37, credited separately
  under 0.3.3.)
- `OBSIDIAN_PORT` env var and `--port <value>` / `--port=<value>`
  CLI flag let users point the MCP server at a non-default Local
  REST API port. Precedence chain (highest first): CLI flag > env
  var > protocol default (27124 HTTPS, 27123 HTTP). Needed for
  multi-vault setups, WSL, and security-hardened deployments.
  Fixes upstream issues #40 and #67. (Shipped in the 0.3.0 cut
  via commit `04765b9`; credited retroactively here.)

## Earlier

Release history before the community-continuation rebrand lives in the upstream repository at
[`jacksteamdev/obsidian-mcp-tools`](https://github.com/jacksteamdev/obsidian-mcp-tools) up to `0.2.27`.

[0.3.3]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.3
[0.3.2]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.2
[0.3.1]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.1
[0.3.0]: https://github.com/istefox/obsidian-mcp-connector/releases/tag/0.3.0
