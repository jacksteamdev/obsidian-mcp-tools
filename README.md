# MCP Tools for Obsidian

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/jacksteamdev/obsidian-mcp-tools)](https://github.com/jacksteamdev/obsidian-mcp-tools/releases/latest)
[![Build status](https://img.shields.io/github/actions/workflow/status/jacksteamdev/obsidian-mcp-tools/release.yml)](https://github.com/jacksteamdev/obsidian-mcp-tools/actions)
[![License](https://img.shields.io/github/license/jacksteamdev/obsidian-mcp-tools)](LICENSE)

[Features](#features) | [Installation](#installation) | [Configuration](#configuration) | [Other MCP clients](#using-with-other-mcp-clients) | [Prompts](#using-prompts) | [Command execution](#command-execution) | [Troubleshooting](#troubleshooting) | [Security](#security) | [Development](#development) | [Support](#support)

> **🔄 Seeking Project Maintainers**
> 
> This project is actively seeking dedicated maintainers to take over development and community management. The project will remain under the current GitHub account for Obsidian plugin store compliance, with new maintainers added as collaborators.
> 
> **Interested?** Join our [Discord community](https://discord.gg/q59pTrN9AA) or check our [maintainer requirements](CONTRIBUTING.md#maintainer-responsibilities).
> 
> **Timeline**: Applications open until **September 15, 2025**. Selection by **September 30, 2025**.

MCP Tools for Obsidian enables AI applications like Claude Desktop to securely access and work with your Obsidian vault through the Model Context Protocol (MCP). MCP is an open protocol that standardizes how AI applications can interact with external data sources and tools while maintaining security and user control. [^2]

This plugin consists of two parts:
1. An Obsidian plugin that adds MCP capabilities to your vault
2. A local MCP server that handles communication with AI applications

When you install this plugin, it will help you set up both components. The MCP server acts as a secure bridge between your vault and AI applications like Claude Desktop. This means AI assistants can read your notes, execute templates, and perform semantic searches - but only when you allow it and only through the server's secure API. The server never gives AI applications direct access to your vault files. [^3]

> **Privacy Note**: When using Claude Desktop with this plugin, your conversations with Claude are not used to train Anthropic's models by default. [^1]

## Features

When connected to an MCP client like Claude Desktop, this plugin enables:

- **Vault Access**: Allows AI assistants to read and reference your notes while maintaining your vault's security [^4]
- **Semantic Search**: AI assistants can search your vault based on meaning and context, not just keywords [^5]
- **Template Integration**: Execute Obsidian templates through AI interactions, with dynamic parameters and content generation [^6]
- **Prompt Library**: Author MCP prompts as markdown files in your vault's `Prompts/` folder, with parameters defined inline via Templater syntax. Your prompt library lives alongside your notes. See [Using prompts](#using-prompts) below.
- **Command Execution** (opt-in): Authorize the agent to run specific Obsidian commands (e.g. `editor:toggle-bold`, `graph:open`) from a per-vault allowlist. Disabled by default; every invocation is audited. See [Command execution](#command-execution) below.

All features require an MCP-compatible client like Claude Desktop, as this plugin provides the server component that enables these integrations. The plugin does not modify Obsidian's functionality directly - instead, it creates a secure bridge that allows AI applications to work with your vault in powerful ways.

## Prerequisites

### Required

- [Obsidian](https://obsidian.md/) v1.7.7 or higher
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and configured with an API key
- An MCP-compatible client. [Claude Desktop](https://claude.ai/download) is the only client the plugin auto-configures — if you use a different client (Claude Code, Cline, Continue, Zed, or any custom MCP client), see [Using with other MCP clients](#using-with-other-mcp-clients) below for manual setup.

### Recommended

- [Templater](https://silentvoid13.github.io/Templater/) plugin for enhanced template functionality
- [Smart Connections](https://smartconnections.app/) plugin for semantic search capabilities

## Installation

> [!Important]
> This plugin requires a secure server component that runs locally on your computer. The server is distributed as a signed executable, with its complete source code available in `packages/mcp-server/`. For details about our security measures and code signing process, see the [Security](#security) section.

1. Install the plugin from Obsidian's Community Plugins
2. Enable the plugin in Obsidian settings
3. Open the plugin settings
4. Click "Install Server" to download and configure the MCP server

Clicking the install button will:

- Download the appropriate MCP server binary for your platform
- Configure Claude Desktop to use the server
- Set up necessary permissions and paths

### Installation Locations

- **Server Binary**: {vault}/.obsidian/plugins/obsidian-mcp-tools/bin/
- **Log Files**:
  - macOS: ~/Library/Logs/obsidian-mcp-tools
  - Windows: %APPDATA%\obsidian-mcp-tools\logs
  - Linux: ~/.local/share/obsidian-mcp-tools/logs

## Configuration

After clicking the "Install Server" button in the plugin settings, the plugin will automatically:

1. Download the appropriate MCP server binary
2. Use your Local REST API plugin's API key
3. Configure Claude Desktop to use the MCP server
4. Set up appropriate paths and permissions

While the configuration process is automated, it requires your explicit permission to install the server binary and modify the Claude Desktop configuration. No additional manual configuration is required beyond this initial setup step.

### Installation location

By default the server binary is installed **outside your vault** in a platform-standard system directory:

- **macOS**: `~/Library/Application Support/obsidian-mcp-tools/bin/`
- **Linux**: `~/.local/share/obsidian-mcp-tools/bin/`
- **Windows**: `%APPDATA%\obsidian-mcp-tools\bin\`

This keeps the ~15 MB binary out of your vault sync (iCloud, Git, Dropbox, Syncthing). If you prefer the legacy behavior — installing the binary inside the vault at `{vault}/.obsidian/plugins/obsidian-mcp-tools/bin/` — you can switch to it under **Installation location → Inside vault (legacy)** in the plugin settings.

If you are upgrading from an earlier version that installed the binary inside your vault, the plugin will detect the legacy location on first load and offer a one-click migration with a confirmation dialog. The migration downloads a fresh copy of the binary to the new location, updates your MCP client config, and deletes the old binary from your vault.

## Using with other MCP clients

The Obsidian plugin only auto-configures Claude Desktop, but the MCP server itself is a standalone binary that speaks MCP over stdio — so it works with any MCP-compatible client, including **Claude Code** (the Anthropic CLI), **Cline**, **Continue**, **Zed**, and custom clients built against the MCP SDK.

### Finding the server binary

After you click "Install Server" from the plugin settings, the binary is downloaded to:

- **macOS / Linux**: `{vault}/.obsidian/plugins/obsidian-mcp-tools/bin/mcp-server`
- **Windows**: `{vault}\.obsidian\plugins\obsidian-mcp-tools\bin\mcp-server.exe`

Replace `{vault}` with the absolute path to your vault directory. You will need this absolute path when configuring a non-Claude-Desktop client, because clients launch the server as an external process.

### Environment variables

The server is configured entirely through environment variables passed by the client at launch time.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `OBSIDIAN_API_KEY` | yes | — | Local REST API key. Copy it from the Local REST API plugin settings in Obsidian. |
| `OBSIDIAN_HOST` | no | `127.0.0.1` | Hostname where Local REST API is listening. |
| `OBSIDIAN_PORT` | no | `27124` (HTTPS) / `27123` (HTTP) | Port where Local REST API is listening. |
| `OBSIDIAN_USE_HTTP` | no | `false` | Set to `true` to connect over HTTP instead of HTTPS. |
| `OBSIDIAN_DISABLED_TOOLS` | no | — | Comma-separated list of tool names to disable (e.g. `patch_vault_file, delete_vault_file`). Unknown names are logged as warnings and do not abort startup. |
| `OBSIDIAN_SERVER_PLATFORM` | no | auto-detect | Force the installer to download a specific server binary. Accepts `linux`, `macos`, or `windows`. Useful when running Obsidian under WSL, Bottles, wine, or another translation layer where `os.platform()` gives the wrong answer. Invalid values silently fall through to auto-detect. |
| `OBSIDIAN_SERVER_ARCH` | no | auto-detect | Force the installer to download a specific architecture. Accepts `x64` or `arm64`. Only affects the macOS download URL (Linux and Windows ship a single binary each). |

The server also accepts a `--port <number>` CLI flag as an alternative to `OBSIDIAN_PORT`. When both are set, the CLI flag wins.

> The plugin also exposes a **Server binary platform** override in the settings UI (under _Advanced_ in the MCP Tools settings tab). It writes the same preference as `OBSIDIAN_SERVER_PLATFORM` / `OBSIDIAN_SERVER_ARCH` into the plugin's own data file. The setting UI takes precedence over the env vars when both are set.

### Example configuration

Most MCP clients expect a JSON config with a `command`, optional `args`, and an `env` block. Here is a generic template that maps onto every client's config shape:

```json
{
  "mcpServers": {
    "obsidian-mcp-tools": {
      "command": "/absolute/path/to/your-vault/.obsidian/plugins/obsidian-mcp-tools/bin/mcp-server",
      "args": [],
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

The exact config file location and the wrapping object shape vary by client:

- **Claude Code** (Anthropic CLI): add via `claude mcp add`, or edit `~/.claude.json` (project scope) / `~/.claude/settings.json` (global scope).
- **Cline**: open the *MCP Servers* panel in the Cline sidebar and add it via the UI.
- **Continue**: configure under `mcpServers` in the Continue config file (see the Continue docs for the current path).
- **Zed**: configure via the assistant settings panel.

Consult your client's own documentation for the current config file path and any client-specific wrapping keys.

### Verifying the setup

Once configured, your client should expose 18 MCP tools from this server, plus any prompts you have tagged with `#mcp-tools-prompt` in a `Prompts/` folder at your vault root.

To verify the connection works end-to-end, ask the agent to call `get_server_info`. A successful response confirms that the client can launch the binary, the binary can reach Local REST API, and the environment variables are being passed through correctly. If the call fails with an authentication error, double-check `OBSIDIAN_API_KEY`. If it fails with a connection error, check `OBSIDIAN_HOST` / `OBSIDIAN_PORT` and make sure the Local REST API plugin is enabled and Obsidian is running.

## Using prompts

The plugin lets you author **MCP prompts** as plain markdown files in your vault. Your prompt library lives alongside your notes, in a folder called `Prompts/` at the root of the vault. Every MCP-compatible client (Claude Desktop, Claude Code, Cline, Continue, Zed, …) will surface these prompts in its own UI — typically as slash commands or attachments.

### Requirements

- The **[Templater](https://silentvoid13.github.io/Templater/)** plugin must be installed and enabled. The prompt feature uses Templater to render the template body.
- A folder named exactly `Prompts` (capital `P`) at the root of your vault.

### Creating a prompt in 60 seconds

1. Create a new folder called `Prompts` at the root of your vault (if it doesn't exist already).
2. Create a new markdown note inside it, e.g. `Prompts/weekly-review.md`.
3. Add frontmatter with the `mcp-tools-prompt` tag and a short description:

   ```markdown
   ---
   tags:
     - mcp-tools-prompt
   description: Summarize my recent daily notes on a given topic
   ---

   Summarize my notes from the past **<% tp.mcpTools.prompt("days", "How many days back to look, e.g. 7") %>** days
   about **<% tp.mcpTools.prompt("topic", "The subject — e.g. 'writing habits'") %>**.

   Give me the three most recurring themes and one action item I should act on this week.
   ```

4. Save the file.
5. In your MCP client, refresh or reconnect to the server. The new prompt will appear — named after the filename (`weekly-review.md`) — with two parameters: `days` and `topic`.
6. Invoke it from your client's UI (e.g. the attachment or slash-command menu in Claude Desktop), fill in the parameters, and the rendered text becomes the first message of a new conversation.

### How parameters work

Parameters are declared inside the template body using a specific Templater pattern:

```
<% tp.mcpTools.prompt("parameter_name", "Description shown to the user") %>
```

The same call at execution time returns the user-supplied value. You can repeat the same parameter name throughout the template — it only shows up once in the client's input form, and the value is injected everywhere.

### Other ways to tag a prompt

Instead of frontmatter, you can drop an inline `#mcp-tools-prompt` hashtag anywhere in the body. Both forms are accepted by the server. Use whichever fits your note-taking style.

### Where is the full reference?

This section covers the 90% case. For the complete contract (folder naming, frontmatter schema, parameter parsing rules, execution flow, known limitations), see **[`docs/features/prompt-system.md`](docs/features/prompt-system.md)**.

## Command execution

The agent can run Obsidian commands on your behalf — the same entries you see in the command palette — but **only if you explicitly authorize them**. This feature is disabled by default and has no effect until you turn it on.

### How it works

Two MCP tools are always advertised to the client:

- `list_obsidian_commands` — read-only discovery, always safe. Returns every command registered in the vault (core + plugins), optionally filtered by a substring. Use this first to find the `id` of a command you want to allow.
- `execute_obsidian_command` — gated. Every call is checked against your allowlist. Calls that fall outside the allowlist return a permission-denied error without executing anything.

On top of the allowlist, `execute_obsidian_command` is rate-limited to **100 calls per minute** (tumbling window, per server process, in-memory) to protect the vault from runaway loops.

### Enabling it

1. Open **Settings → Community plugins → MCP Tools → Command execution**.
2. Tick **Enable MCP command execution**.
3. Under **Browse available commands**, find commands you want to authorize and click **Add** next to each. You can also paste a comma- or newline-separated list into the textarea directly.
4. Click **Save**. Changes apply immediately — no client restart needed.

### What gets logged

Every allow/deny decision is appended to a ring buffer of the last 50 invocations, visible under **Recent invocations** in the same settings section. The audit log includes the command id, the decision, the timestamp, and (for denied calls) the reason. The buffer is pruned automatically so `data.json` stays bounded.

### Security model

- **Deny by default.** The master toggle is off out of the box. An empty allowlist with the toggle on is still deny-all.
- **No wildcards.** Allowlist entries must be exact command ids — there is no `editor:*` pattern.
- **No auto-discovery dumps.** The agent must call `list_obsidian_commands` or the user must paste ids; the allowlist is never populated automatically.
- **Per-vault.** The allowlist lives in each vault's plugin `data.json`. A different vault starts from zero.

For the full threat model and the rationale behind these decisions, see **[`docs/design/issue-29-command-execution.md`](docs/design/issue-29-command-execution.md)**.

## Troubleshooting

If you encounter issues:

1. Check the plugin settings to verify:
   - All required plugins are installed
   - The server is properly installed
   - Claude Desktop is configured
2. Review the logs:
   - Open plugin settings
   - Click "Open Logs" under Resources
   - Look for any error messages or warnings
3. Common Issues:
   - **Server won't start**: Ensure Claude Desktop is running
   - **Connection errors**: Verify Local REST API plugin is configured
   - **Permission errors**: Try reinstalling the server

## Security

### Binary Distribution

- All releases are built using GitHub Actions with reproducible builds
- Binaries are signed and attested using SLSA provenance
- Release workflows are fully auditable in the repository

### Runtime Security

- The MCP server runs with minimal required permissions
- All communication is encrypted
- API keys are stored securely using platform-specific credential storage

### Binary Verification

The MCP server binaries are published with [SLSA Provenance attestations](https://slsa.dev/provenance/v1), which provide cryptographic proof of where and how the binaries were built. This helps ensure the integrity and provenance of the binaries you download.

To verify a binary using the GitHub CLI:

1. Install GitHub CLI:

   ```bash
   # macOS (Homebrew)
   brew install gh

   # Windows (Scoop)
   scoop install gh

   # Linux
   sudo apt install gh  # Debian/Ubuntu
   ```

2. Verify the binary:
   ```bash
   gh attestation verify --owner jacksteamdev <binary path or URL>
   ```

The verification will show:

- The binary's SHA256 hash
- Confirmation that it was built by this repository's GitHub Actions workflows
- The specific workflow file and version tag that created it
- Compliance with SLSA Level 3 build requirements

This verification ensures the binary hasn't been tampered with and was built directly from this repository's source code.

### Reporting Security Issues

Please report security vulnerabilities via our [security policy](SECURITY.md).
Do not report security vulnerabilities in public issues.

## Development

This project uses a monorepo structure with feature-based architecture. For detailed project architecture documentation, see [.clinerules](.clinerules).

### Using Cline

Some code in this project was implemented using the AI coding agent [Cline](https://cline.bot). Cline uses `cline_docs/` and the `.clinerules` file to understand project architecture and patterns when implementing new features.

### Workspace

This project uses a [Bun](https://bun.sh/) workspace structure:

```
packages/
├── mcp-server/        # Server implementation
├── obsidian-plugin/   # Obsidian plugin
└── shared/           # Shared utilities and types
```

### Building

1. Install dependencies:
   ```bash
   bun install
   ```
2. Build all packages:
   ```bash
   bun run build
   ```
3. For development:
   ```bash
   bun run dev
   ```

### Requirements

- [bun](https://bun.sh/) v1.1.42 or higher
- TypeScript 5.0+

## Contributing

**Before contributing, please read our [Contributing Guidelines](CONTRIBUTING.md) including our community standards and behavioral expectations.**

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests:
   ```bash
   bun test
   ```
5. Submit a pull request

We welcome genuine contributions but maintain strict community standards. Be respectful and constructive in all interactions.

## Support

- 💬 [Join our Discord](https://discord.gg/q59pTrN9AA) for questions, discussions, and community support
- [Open an issue](https://github.com/jacksteamdev/obsidian-mcp-tools/issues) for bug reports and feature requests

**Please read our [Contributing Guidelines](CONTRIBUTING.md) before posting.** We maintain high community standards and have zero tolerance for toxic behavior.

## Changelog

See [GitHub Releases](https://github.com/jacksteamdev/obsidian-mcp-tools/releases) for detailed changelog information.

## License

[MIT License](LICENSE)

## Footnotes

[^1]: For information about Claude data privacy and security, see [Claude AI's data usage policy](https://support.anthropic.com/en/articles/8325621-i-would-like-to-input-sensitive-data-into-free-claude-ai-or-claude-pro-who-can-view-my-conversations)
[^2]: For more information about the Model Context Protocol, see [MCP Introduction](https://modelcontextprotocol.io/introduction)
[^3]: For a list of available MCP Clients, see [MCP Example Clients](https://modelcontextprotocol.io/clients)
[^4]: Requires Obsidian plugin Local REST API
[^5]: Requires Obsidian plugin Smart Connections
[^6]: Requires Obsidian plugin Templater
