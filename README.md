# MCP Tools for Obsidian

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/jacksteamdev/obsidian-mcp-tools)](https://github.com/jacksteamdev/obsidian-mcp-tools/releases/latest)
[![Build status](https://img.shields.io/github/actions/workflow/status/jacksteamdev/obsidian-mcp-tools/release.yml)](https://github.com/jacksteamdev/obsidian-mcp-tools/actions)
[![License](https://img.shields.io/github/license/jacksteamdev/obsidian-mcp-tools)](LICENSE)

[Features](#features) | [Installation](#installation) | [Configuration](#configuration) | [Troubleshooting](#troubleshooting) | [Security](#security) | [Development](#development) | [Support](#support)

> **⚠️ Project Unmaintained — Security Notice**
>
> This project is no longer maintained. I stopped using Obsidian, so there is no personal motivation to keep this going.
>
> More importantly: the architecture distributes a downloaded executable to users' machines. That model carries real risk today. AI tooling makes it trivially easy to submit pull requests — including malicious ones — and I do not have the bandwidth or the incentive to audit every contribution at the level this kind of project demands. The consequences of a supply chain attack landing on users are not a burden I'm willing to carry for a project that gives me zero ROI.
>
> **Current release**: the binaries in the latest release were built directly from source via GitHub Actions and carry SLSA provenance attestations — they have not been tampered with. The risk described above is about future contributions, not the current artifacts.
>
> **Current users**: migrate to a plugin that implements MCP over HTTP/SSE. That approach eliminates the need for local executables entirely.
>
> **Future alternatives**: links to community-maintained alternatives will be added here once they clear the official Obsidian review process. If you have built or know of one, DM me on [Discord](https://discord.gg/q59pTrN9AA) with the merged plugin store PR and a link to the project repository.

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

All features require an MCP-compatible client like Claude Desktop, as this plugin provides the server component that enables these integrations. The plugin does not modify Obsidian's functionality directly - instead, it creates a secure bridge that allows AI applications to work with your vault in powerful ways.

## Prerequisites

### Required

- [Obsidian](https://obsidian.md/) v1.7.7 or higher
- [Claude Desktop](https://claude.ai/download) installed and configured
- [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin installed and configured with an API key

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

### For Claude Desktop Users

After clicking the "Install Server" button in the plugin settings, the plugin will automatically:

1. Download the appropriate MCP server binary
2. Use your Local REST API plugin's API key
3. Configure Claude Desktop to use the MCP server
4. Set up appropriate paths and permissions

While the configuration process is automated, it requires your explicit permission to install the server binary and modify the Claude Desktop configuration. No additional manual configuration is required beyond this initial setup step.

### For Other MCP Clients

If you're using a different MCP-compatible client (not Claude Desktop), you'll need to manually configure your client to connect to the MCP server. Here's how:

#### 1. Install the Server Binary

First, install the plugin and click "Install Server" in the plugin settings. This downloads the MCP server binary to:
- `{vault}/.obsidian/plugins/obsidian-mcp-tools/bin/mcp-server` (macOS/Linux)
- `{vault}\.obsidian\plugins\obsidian-mcp-tools\bin\mcp-server.exe` (Windows)

#### 2. Get Your API Key

The server requires your Local REST API plugin's API key. Find it in:
- Obsidian Settings → Community Plugins → Local REST API → Settings → API Key

#### 3. Configure Your MCP Client

Add the MCP server to your client's configuration file. The configuration format varies by client, but typically requires:

**Required environment variables:**
- `OBSIDIAN_API_KEY`: Your Local REST API plugin's API key
- `OBSIDIAN_HOST`: (Optional) Default is `127.0.0.1`
- `OBSIDIAN_USE_HTTP`: (Optional) Set to `"true"` to use HTTP instead of HTTPS
- `OBSIDIAN_HTTP_PORT`: (Optional) Custom HTTP port (default: 27123)
- `OBSIDIAN_HTTPS_PORT`: (Optional) Custom HTTPS port (default: 27124)

**Example configuration for MCP clients:**

```json
{
  "mcpServers": {
    "obsidian-mcp-tools": {
      "command": "/absolute/path/to/your/vault/.obsidian/plugins/obsidian-mcp-tools/bin/mcp-server",
      "env": {
        "OBSIDIAN_API_KEY": "your-local-rest-api-key-here"
      }
    }
  }
}
```

Replace `/absolute/path/to/your/vault/` with the actual absolute path to your Obsidian vault.

#### 4. Common MCP Client Configuration Locations

- **Claude Desktop**:
  - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
  - Linux: `~/.config/Claude/claude_desktop_config.json`
- **Other clients**: Consult your MCP client's documentation for configuration file location

#### 5. Verify Installation

Restart your MCP client after updating the configuration. The MCP server should appear in your client's available tools/servers list. You can test the connection by asking your AI assistant to list files in your vault or perform a search.

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
