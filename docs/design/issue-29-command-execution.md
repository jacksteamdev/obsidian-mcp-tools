# Design: Obsidian Command Execution via MCP

> **Status**: **Fase 1 MVP landed** on branch `feat/command-execution-mvp` (2026-04-11). Fase 2 and Fase 3 are still open.
> **Tracks**: upstream issue #29, upstream PR #47 (both open).
> **Fork context**: this document is the design reference for the `istefox/obsidian-mcp-tools` fork. It intentionally diverges from the upstream PR #47 approach where noted.
>
> **What Fase 1 delivered** (deviation from the original plan documented inline below):
> - Two new MCP tools: `list_obsidian_commands` (read-only, always available) and `execute_obsidian_command` (gated).
> - New plugin endpoint `POST /mcp-tools/command-permission/` (wired in `main.ts` alongside `/search/smart` and `/templates/execute`).
> - In-memory per-process tumbling-window rate limiter, 100 calls/minute.
> - Plugin settings UI at `features/command-permissions/components/CommandPermissionsSettings.svelte`: single master toggle, comma/newline allowlist textarea, live command browser (`app.commands.commands`) with one-click "Add" buttons, recent-invocations audit log (ring buffer, max 50).
> - One deliberate simplification vs. the original plan: **single master toggle** instead of "master enable" + separate "killswitch". Rationale: one lever is easier to understand and the killswitch value was marginal given the allowlist already acts as a narrow gate.
> - **Not** in Fase 1: the confirmation modal path (that's Fase 2) and categorized presets (Fase 3).

## Problem statement

Obsidian exposes an **internal command palette** containing every action the user (and installed plugins) has registered. Issue #29 asks for a way to let an MCP client (e.g. Claude Desktop, Claude Code, Cline) **invoke those commands** via a tool call — so the agent can do things like "open the graph view", "toggle reading mode", "run the template I just created", etc.

Local REST API already exposes the underlying HTTP surface:

- `GET /commands/` — returns `{ commands: [{ id, name }] }`
- `POST /commands/{commandId}/` — executes the command, returns `204 No Content`

The ArkType schemas (`ApiCommand`, `ApiCommandsResponse`) are already defined in `packages/shared/src/types/plugin-local-rest-api.ts:158-170`. So the **HTTP plumbing is already in place**; this document is about the **policy layer** on top of it, which is the actual hard problem.

## Why this is hard

Three properties of Obsidian commands make a naive "pass-through" dangerous:

1. **The command list is dynamic and unpredictable.** It depends on the exact set of plugins installed in the user's vault, the user's custom hotkey mappings, and Obsidian's built-ins. A fresh install has ~150 commands; a heavily-customized vault can have 500+. **A static allowlist in the MCP server source tree cannot cover all users.**

2. **Command IDs give no signal about destructiveness.** `editor:toggle-bold` is safe. `editor:delete-file` is destructive. `my-cleanup-plugin:purge-duplicates` could be anything — we literally do not know. Prefix-based classification is a false cognate: plugins name commands however they want, and there is no convention that "dangerous" commands announce themselves.

3. **Plugins of unknown provenance are in the trust boundary.** Any plugin installed in the user's vault can register commands. A misbehaving or malicious plugin can add a command with an innocuous-looking name whose effect is unbounded. Our threat model must assume the LLM can be socially engineered into invoking whatever is available.

A naive implementation ("just expose `execute_command(id)` as a tool") lets the LLM invoke arbitrary code in the user's note-taking environment with no consent step. That is unacceptable.

## Surface of the current proposal (upstream PR #47)

Upstream PR #47 is open but not merged. From the upstream context in `CLAUDE.md`, it adds a tool for Obsidian command execution but leaves policy design unresolved. The PR has not been reviewed by the project owner.

**This design document replaces that approach rather than refining it.** Even if the fork eventually cherry-picks pieces of PR #47, the policy model described below should be the contract.

## Threat model

| Actor | Capability | Mitigation covered here |
|---|---|---|
| MCP client (LLM) | Can invoke tools | Must pass through an allowlist or per-call user confirmation |
| MCP client (malicious prompt injection) | Can try to invoke destructive commands disguised as harmless | Same: the consent step is the trust boundary |
| Third-party Obsidian plugin | Can register commands with arbitrary effects | Out of scope — this is an Obsidian trust boundary, not ours. We surface the command id *and* its human name so the user can make an informed decision. |
| User | Clicks through consent prompts without reading | Mitigated but not eliminated — rate limit + warning colors for commands matching destructive patterns |
| Local attacker with filesystem access | Can edit the plugin's `data.json` to add entries to the allowlist | Out of scope — if they have local filesystem access, the plugin is already compromised. Same trust boundary as the API key. |

## Policy options considered

### Option A — Static whitelist (hardcoded in server source)

Maintain a list of known-safe command IDs. The LLM can only invoke those.

- **Pro**: maximum safety, zero surprises at runtime.
- **Contro**: rejected because the command list is dynamic. Users with custom plugins would have no way to use them. The list would decay as Obsidian evolves. Not scalable.

### Option B — Static denylist (block known-destructive patterns)

Block command IDs matching patterns like `*:delete`, `*:remove`, `*:uninstall`, `settings:*`, etc. Everything else passes.

- **Pro**: more permissive, covers the obvious 80%.
- **Contro**: **rejected**. Gives false sense of security. A plugin command named `my-plugin:cleanup-duplicates` passes the denylist but can wipe files. Naming conventions are not enforced, and the LLM has no way to tell. Any policy that lets arbitrary plugin commands through by default is unacceptable.

### Option C — User-configured per-command allowlist (static enable-per-command)

In plugin settings, the user sees the full list of commands in their vault and toggles each one individually. Default: all disabled.

- **Pro**: complete user control, zero ambiguity about what is authorized.
- **Contro**: UX is heavy for vaults with hundreds of commands. Manageable with a search filter in the UI, but still requires the user to proactively think about every command before the first invocation. Not suitable as a sole mechanism.

### Option D — Category-level allowlist (enable-per-prefix)

Group commands by ID prefix (`editor:*`, `workspace:*`, `file-explorer:*`) and let the user enable whole categories.

- **Pro**: less granular, easier to configure.
- **Contro**: **rejected**. Plugin authors use prefix conventions inconsistently, and a single category can mix safe and destructive commands. A prefix-level toggle is just Option B with extra steps.

### Option E — Per-invocation confirmation dialog (no persistence)

Every time the LLM tries to invoke a command, the plugin shows a modal in the Obsidian UI asking the user to confirm. No state is persisted between calls.

- **Pro**: maximum control — every call is a conscious decision.
- **Contro**: **UX is unworkable**. If the LLM invokes 10 commands in a single conversation turn, the user gets 10 modals. Breaks the agentic workflow entirely. Only viable as a fallback path.

### Option F — Hybrid: per-invocation prompt with persistent "Allow always"

**Recommended.**

- Default state: no commands are authorized.
- When the LLM invokes a command not yet in the user's allowlist, the plugin shows a modal with the command's **ID, human name, and a short warning**, plus three buttons: **Deny**, **Allow once**, **Allow always**.
- **Allow always** adds the command to the user's persistent allowlist in `plugin.saveData()`. Future invocations of the same ID execute without a prompt.
- **Allow once** executes just this invocation without persisting.
- **Deny** returns an error to the MCP client: `McpError(ErrorCode.InvalidRequest, "User denied permission to execute '<id>'")`.
- The user can inspect and edit the allowlist at any time in the settings UI (add, remove, clear).

- **Pro**: principle of least privilege + practical UX. The allowlist grows organically as the user works with the agent. Familiar pattern (browser permission prompts, macOS privacy prompts, phone app permissions). First invocation is explicit; subsequent are frictionless.
- **Contro**: more complex to implement (modal + long-polling HTTP endpoint + persistent state + rate-limit). The trade-off is acceptable — it's the only option that reconciles safety with the agentic use case.

## Recommended approach: Option F

### High-level flow

```
MCP client → execute_obsidian_command(id) tool call
                ↓
         ┌──────┴───────┐
         │ MCP server   │
         │   checks     │
         │   allowlist  │
         └──────┬───────┘
                ↓
       id in allowlist?
           /       \
         yes        no
          |          |
          |          ▼
          |    POST /mcp-tools/command-permission/:id
          |    (new endpoint in this plugin; long-polls
          |     until user answers or 30s timeout)
          |          |
          |     ┌────┴─────┐
          |     │ Modal    │
          |     │ in       │
          |     │ Obsidian │
          |     └────┬─────┘
          |          ↓
          |     { "allow-once" | "allow-always" | "deny" | "timeout" }
          |          |
          ▼          ▼
    POST /commands/:id (Local REST API, executes the command)
                ↓
       204 No Content
                ↓
    Audit log entry written
                ↓
    Return `{ content: [{ type: "text", text: "Executed <name>" }] }`
```

### MCP tool surface

Two new tools, both registered in a new `packages/mcp-server/src/features/commands/` feature module:

#### `list_obsidian_commands`

Read-only discovery tool. Safe, no policy gate.

```ts
tools.register(
  type({
    name: '"list_obsidian_commands"',
    arguments: {
      "query?": type("string").describe(
        "Optional fuzzy filter applied to both command IDs and human names. Case-insensitive substring match.",
      ),
    },
  }).describe(
    "List the Obsidian commands available in the current vault. Use this to discover what commands exist before calling execute_obsidian_command. The list is dynamic — it depends on the user's installed plugins and hotkey mappings.",
  ),
  async ({ arguments: args }) => {
    const data = await makeRequest(
      LocalRestAPI.ApiCommandsResponse,
      "/commands/",
    );
    const query = args.query?.toLowerCase();
    const filtered = query
      ? data.commands.filter(
          (c) =>
            c.id.toLowerCase().includes(query) ||
            c.name.toLowerCase().includes(query),
        )
      : data.commands;
    return {
      content: [{ type: "text", text: JSON.stringify(filtered, null, 2) }],
    };
  },
);
```

#### `execute_obsidian_command`

Execution tool. Always goes through the permission check.

```ts
tools.register(
  type({
    name: '"execute_obsidian_command"',
    arguments: {
      commandId: type("string>0").describe(
        "The Obsidian command id to execute, e.g. `editor:toggle-bold`. The user must either have pre-authorized this command in the plugin settings, or approve a runtime confirmation dialog shown in the Obsidian UI. Unknown commands return a 404.",
      ),
    },
  }).describe(
    "Execute an Obsidian command by id. Commands are plugin-provided and vary between vaults — always call list_obsidian_commands first to discover what's available. The first invocation of any command triggers a user confirmation dialog in the Obsidian UI; subsequent invocations of the same command may execute without a prompt if the user chose 'Allow always'.",
  ),
  async ({ arguments: args }) => {
    // 1. Ask the plugin whether this command is permitted.
    //    New endpoint `/mcp-tools/command-permission/` in this repo's plugin.
    //    The plugin checks the allowlist first; if not allowed, it shows a
    //    modal and long-polls until the user answers (max 30s) or returns
    //    "timeout".
    const permission = await makeRequest(
      CommandPermissionResponse,
      `/mcp-tools/command-permission/${encodeURIComponent(args.commandId)}/`,
      { method: "POST" },
    );

    if (permission.decision === "deny" || permission.decision === "timeout") {
      throw new McpError(
        ErrorCode.InvalidRequest,
        `User ${permission.decision === "deny" ? "denied" : "did not answer"} permission to execute command '${args.commandId}'`,
      );
    }

    // 2. Execute via Local REST API.
    await makeRequest(
      EmptyResponse,
      `/commands/${encodeURIComponent(args.commandId)}/`,
      { method: "POST" },
    );

    return {
      content: [
        {
          type: "text",
          text: `Executed '${args.commandId}' (decision: ${permission.decision})`,
        },
      ],
    };
  },
);
```

### Plugin-side endpoint: `POST /mcp-tools/command-permission/:id/`

A new HTTP endpoint registered by the plugin's `main.ts` (same pattern used today for `/search/smart` and `/templates/execute`). Responsibility:

1. Parse the command ID from the route parameter.
2. Load settings via `plugin.loadData()`. Check the allowlist.
3. **If the command is in the allowlist**: return immediately with `{ decision: "allow-always" }`.
4. **If the killswitch is enabled** (`commandPermissions.killswitch === true`): return `{ decision: "deny" }`.
5. **Otherwise**: open a Svelte-backed modal in the Obsidian UI that shows the command ID + human name (fetched from `app.commands.commands[id]?.name`) + warning text. Long-poll the HTTP response until the user clicks a button or 30 seconds elapse.
6. On user action, update settings if needed (persist allowlist entry for "allow-always") and return the decision.
7. On timeout, return `{ decision: "timeout" }` and dismiss the modal automatically.

Response schema:

```ts
// in packages/shared/src/types/plugin-local-rest-api.ts (new)
export const CommandPermissionResponse = type({
  decision: '"allow-once" | "allow-always" | "deny" | "timeout"',
});
```

### Settings UI (plugin side)

New feature module `packages/obsidian-plugin/src/features/command-permissions/`:

```
command-permissions/
├── components/
│   ├── CommandPermissionModal.svelte     # the prompt shown in Obsidian UI
│   └── CommandPermissionSettings.svelte  # the settings tab section
├── services/
│   ├── permissionCheck.ts                # handle the HTTP endpoint + modal invocation
│   └── audit.ts                          # structured logging of invocations
├── types.ts                              # settings augmentation
├── utils.ts                              # allowlist parsing, destructive-pattern matching
└── index.ts
```

**Settings augmentation**:

```ts
declare module "obsidian" {
  interface McpToolsPluginSettings {
    commandPermissions?: {
      /**
       * Commands the user has permanently approved via the "Allow always"
       * button. Executing any of these skips the confirmation modal.
       */
      allowlist?: string[];

      /**
       * Master killswitch. When true, every execute_obsidian_command call
       * is immediately rejected with "deny" — no modal, no list check.
       * Intended as an emergency off-switch for users who want to disable
       * command execution entirely without uninstalling the feature.
       */
      killswitch?: boolean;

      /**
       * When true, the allowlist is ignored and every invocation triggers
       * a confirmation modal. "Allow always" still works but is only
       * remembered for the current Obsidian session.
       */
      requireConfirmationEveryTime?: boolean;
    };
  }
}
```

**Settings tab layout** (under a new "Command execution" section):

- **Master toggle — Enable command execution**: if off, the two new tools (`list_obsidian_commands`, `execute_obsidian_command`) are registered but short-circuit to an error. This is distinct from `killswitch` because it also hides the list from the LLM — stricter.
- **Killswitch — Deny all commands**: hard-off even if the tools are enabled. Useful for "I'm in a sensitive editing session, turn off LLM access temporarily".
- **Require confirmation every time**: disables the "Allow always" persistence.
- **Allowlist editor**: a list view showing every entry in `commandPermissions.allowlist` with a remove button. A "Clear all" button at the bottom with a confirmation dialog.
- **Recent invocations**: the last 50 entries from the audit log (timestamp, command ID, decision, execution outcome). Scrollable.

### Audit log

A structured log written on every invocation of `execute_obsidian_command`. Stored in a bounded ring buffer in plugin settings (`commandPermissions.recentInvocations?: AuditEntry[]`, max 50 entries) so it survives across sessions and shows up in the settings UI. Also mirrored to the main plugin log file for long-term analysis.

```ts
interface AuditEntry {
  timestamp: string; // ISO 8601
  commandId: string;
  commandName?: string; // human name if resolvable
  decision: "allow-once" | "allow-always" | "deny" | "timeout";
  executed: boolean; // false if decision was deny/timeout or HTTP error
  error?: string;
}
```

### Rate limiting

Defense against a runaway LLM or malicious prompt that tries to flood the plugin with command invocations.

- **Soft limit**: 30 commands per rolling 60-second window. When exceeded, the next invocation's modal includes a red warning: *"The agent has invoked 31 commands in the last minute. Are you sure this is intentional?"*
- **Hard limit**: 100 commands per rolling 60-second window. Above this, the plugin rejects with `McpError(ErrorCode.InvalidRequest, "Rate limit exceeded: too many command executions")` and logs a warning. The user can override by adjusting a setting (hidden under "Advanced").
- `list_obsidian_commands` is **not** rate-limited (read-only).

Rate limiter state lives in memory on the plugin side (not persisted). Resets when Obsidian reloads, which is acceptable — the point is to catch short bursts, not enforce long-term quotas.

### Destructive-command warnings

When the modal is shown, inspect the command ID for patterns known to be destructive:

- Regex: `/\b(delete|remove|uninstall|trash|clean(up)?|purge|drop|reset|clear|wipe)\b/i`
- On match: the modal title bar is tinted red, the warning text is prepended with *"⚠️ This command may be destructive."*, and the "Allow always" button is **disabled** (only "Allow once" and "Deny" available).

This is heuristic, not a guarantee. The user must still think. The red tint is nudge, not gate.

## Implementation phases

### MVP (fase 1) — minimum-viable safety

Target: feature usable by tech-savvy users, full safety model in place, reduced UX polish.

Scope:
- `list_obsidian_commands` tool — full.
- `execute_obsidian_command` tool — gated on allowlist only. No modal. If the command is not in the allowlist, the tool returns `{ decision: "deny" }` immediately.
- Settings UI: allowlist editor (add by ID manually, paste from the list tool's output), killswitch, master enable toggle.
- Audit log file-based (no UI viewer yet).
- Rate limiter (hard limit only).
- Existing tests for the MCP tool schemas; one integration test that verifies the allowlist gate.

Out of scope for MVP:
- Modal in the Obsidian UI (users configure allowlist manually).
- Long-polling HTTP endpoint.
- Audit log UI viewer.
- Destructive pattern warnings.
- Soft rate limit.

### Fase 2 — UX polish

Target: the feature becomes usable for non-technical users.

Scope:
- Svelte modal with the "Allow once / always / deny" flow.
- Long-polling `/mcp-tools/command-permission/:id/` endpoint.
- "Recent invocations" section in settings with the audit log viewer.
- Destructive-command warnings (red tint + disabled "Allow always").
- Soft rate limit with warning in the modal.

### Fase 3 — hardening

Target: production-ready.

Scope:
- Automated tests for the permission flow (spy on the HTTP client, assert modal was shown, simulate user decisions).
- Configurable rate limits via hidden settings.
- Export audit log as CSV from settings UI.
- Documentation in README for end users.
- CLAUDE.md gotcha entry documenting the permission model.

## Non-goals

- **Executing commands without user knowledge** — explicitly forbidden, regardless of how "safe" the command looks.
- **Inferring safety from command ID** — too error-prone, see threat model above.
- **Cross-vault allowlists** — allowlists are per-vault because the command list itself is per-vault (plugins differ). The user configures each vault separately.
- **Conditional command execution** (e.g., "only allow this command if it's Tuesday") — out of scope. If needed, users can toggle the killswitch manually.
- **Backward compatibility with upstream PR #47's API** — we diverge deliberately. The fork has no obligation to match an unmerged upstream proposal.

## Open questions for the implementer

Before starting the MVP, the following need user-level judgment calls:

1. **Should `list_obsidian_commands` itself be gated by the master enable toggle?** My current position: yes, because even knowing the command list is information the user may not want to expose. Disabling the master toggle should make the MCP client see neither tool.

2. **What happens if `execute_obsidian_command` is invoked while the master toggle is off?** Two options: (a) the tool is not registered at all (the MCP client sees 17 tools instead of 18), or (b) the tool is registered but always returns an error. Option (a) is cleaner but requires ToolRegistry to support dynamic registration at runtime (not just startup). Option (b) is trivially implementable today. **Recommendation**: option (b) for MVP; migrate to (a) in Fase 3.

3. **Should the confirmation modal support a "Deny always" option?** My current position: no. A denylist adds complexity and overlaps awkwardly with the killswitch. If the user wants to permanently block a specific command, they can use the killswitch instead; the use case for "deny this one specific command forever" is too narrow to justify the UX cost.

4. **What exactly constitutes "the command" for allowlist purposes — the ID alone, or the (ID, name) tuple?** My current position: **just the ID**. The human name can change when Obsidian or plugins update, but IDs are stable. Using only the ID means a future rename doesn't surprise the user by silently revoking authorization.

5. **Should the audit log include the MCP client identity?** The MCP SDK 1.0.4 used in this repo does not expose a reliable client identifier, so this is mostly moot for MVP. If the SDK upgrade (roadmap #8) lands first, the log should include `clientId` as a new field.

## References

- `packages/shared/src/types/plugin-local-rest-api.ts:158-170` — existing `ApiCommand` and `ApiCommandsResponse` schemas.
- `packages/obsidian-plugin/docs/openapi.yaml:492-542` — Local REST API contract for the commands endpoints.
- `packages/obsidian-plugin/src/main.ts:54-61` — pattern for registering a new HTTP route on the Local REST API plugin (`this.localRestApi.api.addRoute(...)`), reused by the proposed `/mcp-tools/command-permission/:id/` endpoint.
- [Obsidian API `Commands` interface](https://docs.obsidian.md/Reference/TypeScript+API/Commands) — for resolving a command ID to its human name inside the plugin.
- [MCP protocol error model](https://modelcontextprotocol.io/docs/errors) — how to return permission-denied errors to the client.

## Decision

**Proceed with Option F (hybrid) when the feature is ready to be built. Start with the MVP (Fase 1) — which is ~1 day of work — and iterate in Fase 2/3 based on user feedback.**

This design should be treated as authoritative for the fork. Anyone implementing the feature should re-read this document first and update it if the implementation reveals constraints the design missed.

---

*Document version*: 1 — initial draft, 2026-04-11. Author: design review session in `istefox/obsidian-mcp-tools`.
