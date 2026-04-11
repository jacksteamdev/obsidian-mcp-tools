# Prompt system

This document is the **authoritative reference** for how the prompt feature works end-to-end: the vault-side contract an Obsidian user must follow to author a prompt, and the server-side machinery that discovers, validates, and executes those prompts through the Model Context Protocol.

It replaces the earlier `prompt-requirements.md`, which was an implementation planning doc written before the feature shipped and no longer reflects reality.

## What is a prompt (MCP context)

The Model Context Protocol distinguishes two kinds of things a server can expose to a client:

- **Tools** — actions the agent can take (read a file, search, execute a template). The agent decides when to call them.
- **Prompts** — pre-written, parameterized messages the *user* can invoke from a chat input, typically to insert a well-crafted context or instruction into the conversation. The client (Claude Desktop, Cline, Claude Code, Zed, …) renders them in its "slash command" or "attachment" UI so the user can pick one and supply any arguments.

This plugin makes every markdown file in your vault's `Prompts/` folder that is tagged `mcp-tools-prompt` available as an MCP prompt. The **vault itself becomes your prompt library**, editable with the same tool you already use for notes — no separate UI, no separate config file, no developer work.

## The vault-side contract

To make a file available as a prompt, you must satisfy **three** conditions. Miss any one of them and the file will be silently skipped during discovery.

### 1. The file must live in a folder named `Prompts/` at the vault root

The folder name is **exact and case-sensitive**. It is hardcoded to `Prompts` (capital P, no trailing slash, no nested subfolders — only direct children of `Prompts/` are scanned).

- ✅ `{vault}/Prompts/my-prompt.md`
- ❌ `{vault}/prompts/my-prompt.md` (lowercase p)
- ❌ `{vault}/Prompts/subfolder/my-prompt.md` (nested)
- ❌ `{vault}/MCP Prompts/my-prompt.md` (different folder name)
- ❌ `{vault}/Notes/Prompts/my-prompt.md` (not at root)

If the `Prompts/` folder does not exist at all, the server returns an empty list of prompts — no error. You can create the folder from within Obsidian whenever you're ready to start writing prompts.

### 2. The file must be tagged `mcp-tools-prompt`

Obsidian supports **two** ways to attach a tag to a note and both are accepted:

**Option A — Frontmatter tag** (recommended):

```yaml
---
tags:
  - mcp-tools-prompt
description: Generate a weekly review based on my daily notes
---
```

**Option B — Inline hashtag** in the body:

```markdown
#mcp-tools-prompt

Generate a weekly review based on my daily notes from the past 7 days.
```

Both forms end up as the string `"mcp-tools-prompt"` in the file's unified tag list (the Local REST API flattens frontmatter tags and inline hashtags into a single `tags[]` array when it returns the file). The server checks `tags.includes("mcp-tools-prompt")` — no `#` prefix, no variation allowed. Tag names like `mcp_tools_prompt`, `MCP-Tools-Prompt`, or `prompt` will not match.

Files without this tag are silently filtered out of the prompt list. This lets you keep other kinds of notes in the `Prompts/` folder (drafts, documentation, shared templates) without exposing them to MCP clients.

### 3. The file must be a `.md` file

Non-markdown files in `Prompts/` (`.canvas`, `.pdf`, images, etc.) are skipped. This is a cheap extension check before the server bothers fetching the file's content.

## Frontmatter

The frontmatter schema is simple:

| Field | Required | Type | Purpose |
|---|---|---|---|
| `tags` | yes (if not using inline hashtag) | string list | Must include `mcp-tools-prompt`. |
| `description` | no | string | Shown to the LLM as the prompt's description in `prompts/list`. Strongly recommended — this is how the user (and the model, when helping the user pick a prompt) understands what the prompt does. |

Any other frontmatter fields are ignored by the server. You can keep your own metadata alongside (e.g. Dataview fields, author notes, a timestamp) and it will not interfere with prompt discovery.

## Prompt arguments: Templater syntax

A prompt can accept **arguments** that the user supplies at invocation time — for example a topic, a date range, a person's name. Arguments are declared **inside the prompt body** using a specific Templater pattern:

```markdown
<% tp.mcpTools.prompt("topic", "The subject you want me to write about") %>
```

The server parses the prompt file's content with an AST (via `acorn`), walks every `<% … %>` tag, and extracts each `tp.mcpTools.prompt(name, description)` call it finds. The first argument becomes the parameter's **name**, the second becomes its **description** shown to the client UI.

### Rules and gotchas

- **The function name must be exactly `tp.mcpTools.prompt`.** Not `tp.prompt`, not `mcpTools.prompt`, not `prompt`. The AST matcher looks for the specific member-expression chain `tp → mcpTools → prompt`.
- **Arguments must be string literals.** `tp.mcpTools.prompt("topic")` works. `tp.mcpTools.prompt(someVar)` does not — the parser only accepts literal strings, not expressions, variables, or template interpolations.
- **The second argument (description) is optional** but strongly recommended. Without it, the client UI shows the parameter name only and the user has to guess what to type.
- **All parameters are optional at validation time.** The server does not currently enforce "required" arguments — if the user omits one, the Templater function simply returns an empty string when invoked inside the template. This is a deliberate choice: it keeps prompts usable even when invoked with partial inputs. If you need a parameter to be mandatory, guard it inside the template body (e.g. `<% if (tp.mcpTools.prompt("topic") === "") return "Please supply a topic" %>`).
- **Templater modifier characters** (`*`, `-`, `_`) on the tag delimiters are supported: `<%* … %>`, `<%- … -%>`, etc. The parser strips them before running the AST walk.
- **Duplicate names are allowed** but pointless — the client only displays each unique parameter once in its UI, and all usages inside the template reference the same value.

### Using arguments inside the template

The same `tp.mcpTools.prompt("name")` call returns the user-supplied value at execution time. You can scatter it throughout the template freely:

```markdown
Write a <% tp.mcpTools.prompt("length", "Length — short, medium, or long") %>
summary about **<% tp.mcpTools.prompt("topic", "The subject") %>**.

Focus on:
- How <% tp.mcpTools.prompt("topic") %> relates to productivity
- Practical takeaways the reader can apply today
```

In the example above, `topic` appears three times but only shows up **once** in the client's parameter form. The user enters it once and the value is injected everywhere.

## A complete example

```markdown
---
tags:
  - mcp-tools-prompt
description: Summarize my recent daily notes on a given topic
---

<%*
// This comment block is a Templater run mode — it's ignored by the
// prompt parser because the parser only extracts tp.mcpTools.prompt()
// calls, not plain JS statements.
-%>

Summarize my notes from the past **<% tp.mcpTools.prompt("days", "How many days back to look, e.g. 7") %>** days
about **<% tp.mcpTools.prompt("topic", "The subject — e.g. 'writing habits'") %>**.

Give me:

1. The three most recurring themes.
2. Any contradictions I wrote down on different days.
3. An action item I should act on this week.

Ignore any note that contains the tag `#archive`.
```

When this file is placed at `{vault}/Prompts/daily-notes-summary.md`, an MCP client will see a new prompt called `daily-notes-summary.md` with:

- Description: *"Summarize my recent daily notes on a given topic"* (from frontmatter)
- Parameters: `days` (*"How many days back to look, e.g. 7"*), `topic` (*"The subject — e.g. 'writing habits'"*)

The user clicks it in the client UI, fills in `days=7` and `topic=focus habits`, and the client sends the rendered text as the first message of a new conversation.

## How the server actually runs a prompt

This is the flow the user doesn't see but which every maintainer should understand before changing anything.

### Discovery — `prompts/list`

Triggered when the MCP client asks "what prompts are available?":

1. `GET /vault/Prompts/` via Local REST API → a directory listing of `Prompts/`.
2. For each entry:
   1. Skip anything that doesn't end with `.md`.
   2. `GET /vault/Prompts/{filename}` with `Accept: application/vnd.olrapi.note+json` → fetches the file as structured JSON with the unified `tags[]` array, the parsed `frontmatter`, and the raw markdown `content`.
   3. If `tags` does not include `"mcp-tools-prompt"` → skip.
   4. Otherwise, call `parseTemplateParameters(content)` to extract the declared parameters from the body.
3. Return a `PromptMetadata[]` containing `{ name, description, arguments }` for each surviving file.

Cost: one HTTP call to list the folder + one HTTP call per file. For a `Prompts/` folder with a handful of files this is fast; for a folder with hundreds of files you may notice the discovery latency. No caching today — every `prompts/list` re-fetches everything.

### Execution — `prompts/get`

Triggered when the user selects a prompt and clicks "insert" in the client UI:

1. Construct the full vault path: `Prompts/{name}` (where `name` is whatever the client sent — usually the filename).
2. `GET /vault/Prompts/{name}` with the same JSON accept header.
3. Validate the frontmatter against `PromptFrontmatterSchema` (which requires the `mcp-tools-prompt` tag). If validation fails, throw `McpError`.
4. Re-parse the template parameters from the content (same `parseTemplateParameters` call as in discovery).
5. Build an ArkType schema from the parameter list where every field is `string?` (optional). Validate the user-supplied `arguments` against that schema. Unknown fields, type mismatches, etc., produce an `InvalidParams` error.
6. `POST /templates/execute` — the custom endpoint registered by this plugin in `packages/obsidian-plugin/src/main.ts:65`. This endpoint:
   1. Locates the template file inside the vault.
   2. Builds a Templater `running_config`.
   3. Monkey-patches Templater's `functions_generator.generate_object` to inject `tp.mcpTools.prompt` as a user function that reads from the supplied `arguments` object.
   4. Calls `templater.read_and_parse_template(config)` to render the markdown.
   5. Restores the original `generate_object`.
   6. Returns the rendered content as JSON.
7. The server strips the frontmatter from the rendered content by splitting on `---` and taking the last segment.
8. Wraps the result in an MCP `GetPromptResult` with a single user message:
   ```ts
   { messages: [{ role: "user", content: { type: "text", text: rendered } }] }
   ```

### Why Templater and not a custom template engine?

The plugin delegates template rendering to **Templater**, the user's own plugin, for three reasons:

1. **Users already know Templater syntax.** No new templating language to learn.
2. **Templater already handles the hard parts** — Obsidian context, file operations, date math, system prompts, etc. Re-implementing any of those in the MCP server would duplicate a mature plugin.
3. **The prompt library becomes interoperable with existing templates.** A file that was already a Templater template can become an MCP prompt just by adding one tag.

The trade-off: **Templater is a required dependency**. Without it installed and enabled, `prompts/get` returns an error (503 Templater not available). Templater is listed as "optional" in the plugin's dependency check because it's only required by the prompt and template features — the vault file tools work without it.

## Known limitations

- **No "required" argument enforcement.** Mentioned above. All parameters are optional from the validator's point of view.
- **No nested `Prompts/` subfolders.** Only direct children of `Prompts/` are scanned. If you want to organize prompts by category, use tag-based or frontmatter-based filtering inside the folder.
- **No caching of the discovery results.** Every `prompts/list` re-fetches every file. On large prompt libraries this is unnecessary work; a simple in-memory cache keyed by (filename, mtime) would speed things up but has not been implemented.
- **Filenames are the prompt IDs.** There's no separate "name" field in the frontmatter that would let you rename the prompt displayed to the client without renaming the file. If you want a prettier name, rename the file.
- **Prompts cannot emit images, audio, or multiple messages.** The result is always a single user message with `type: "text"`. Multimodal prompts would require a significant refactor.
- **No error when a file almost-satisfies the contract.** If you misspell the tag or put the file in `prompts/` (lowercase), the file is silently skipped — there is no diagnostic in the plugin settings telling you which files were considered and rejected. If you expect a prompt to appear and it doesn't, check the three conditions above in order.

## Client-side: how to invoke prompts

This section is client-specific — each MCP client surfaces prompts differently.

### Claude Desktop

Prompts appear in the "Attach from MCP" button at the bottom of the chat input. Click the paperclip-style icon, pick the MCP server (`obsidian-mcp-tools`), then the prompt you want. If the prompt has arguments, Claude Desktop prompts you for each one. Pressing Enter sends the rendered text as the first user message.

### Claude Code (Anthropic CLI)

Prompts appear as slash commands: `/mcp__obsidian-mcp-tools__my-prompt`. Arguments are passed inline after the slash command. See the Claude Code docs for the exact syntax, which may change between versions.

### Other clients

Consult your client's documentation. The MCP specification reserves the right for clients to expose prompts however they like — slash commands, modal dialogs, dropdowns, inline buttons, etc.

## References

- Server handler: `packages/mcp-server/src/features/prompts/index.ts` — `setupObsidianPrompts()` registers both `ListPromptsRequestSchema` and `GetPromptRequestSchema` handlers.
- Argument parser: `packages/mcp-server/src/shared/parseTemplateParameters.ts` — AST walk that finds `tp.mcpTools.prompt()` calls.
- Argument validator: `packages/shared/src/types/prompts.ts` — `buildTemplateArgumentsSchema()` generates the per-prompt ArkType schema at runtime.
- Plugin endpoint: `packages/obsidian-plugin/src/main.ts:67-164` — `handleTemplateExecution()` does the Templater integration, including the `generate_object` monkey-patch that injects the `tp.mcpTools.prompt` user function.
- Frontmatter schema: `packages/shared/src/types/prompts.ts` — `PromptFrontmatterSchema` with the `mcp-tools-prompt` tag narrow.
- [Model Context Protocol prompts spec](https://modelcontextprotocol.io/docs/concepts/prompts) — upstream protocol documentation.
- [Templater documentation](https://silentvoid13.github.io/Templater/) — for the template syntax used inside prompt bodies.
