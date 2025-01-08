# Advanced MCP Server for Obsidian

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/jacksteamdev/advanced-mcp-server)](https://github.com/jacksteamdev/advanced-mcp-server/releases/latest)
[![Build status](https://img.shields.io/github/actions/workflow/status/jacksteamdev/advanced-mcp-server/release.yml)](https://github.com/jacksteamdev/advanced-mcp-server/actions)
[![License](https://img.shields.io/github/license/jacksteamdev/advanced-mcp-server)](LICENSE)

[Features](#features) | [Installation](#installation) | [Configuration](#configuration) | [Troubleshooting](#troubleshooting) | [Security](#security) | [Development](#development) | [Support](#support)

The Advanced MCP Server for Obsidian enables AI applications like Claude Desktop to securely access and work with your Obsidian vault through the Model Context Protocol (MCP). MCP is an open protocol that standardizes how AI applications can interact with external data sources and tools while maintaining security and user control. [^2]

When you install this plugin, it connects to a local MCP server that acts as a secure bridge between your Obsidian vault and MCP-compatible AI applications. This means AI assistants can read your notes, execute templates, and perform semantic searches - but only with your explicit permission and without requiring direct access to your vault files. [^3]

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

- **Server Binary**: {vault}/.obsidian/plugins/advanced-mcp-server/bin/
- **Server Log Files**:
  - macOS: ~/Library/Logs/Claude/obsidian-advanced-mcp-server
  - Windows: %APPDATA%\Claude\logs\obsidian-advanced-mcp-server
  - Linux: ~/.local/share/Claude/logs/obsidian-advanced-mcp-server

## Configuration

After clicking the "Install Server" button in the plugin settings, the plugin will automatically:

1. Download the appropriate MCP server binary
2. Use your Local REST API plugin's API key
3. Configure Claude Desktop to use the MCP server
4. Set up appropriate paths and permissions

While the configuration process is automated, it requires your explicit permission to install the server binary and modify the Claude Desktop configuration. No additional manual configuration is required beyond this initial setup step.

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

This project uses a bun workspace structure:

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

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests:
   ```bash
   bun test
   ```
5. Submit a pull request

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

## Support

- [Open an issue](https://github.com/jacksteamdev/obsidian-advanced-mcp-server/issues) for bug reports and feature requests
- [Start a discussion](https://github.com/jacksteamdev/obsidian-advanced-mcp-server/discussions) for questions and general help

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes in each release.

## License

[MIT License](LICENSE)

## Footnotes

[^1]: For information about Claude data privacy and security, see [Claude AI's data usage policy](https://support.anthropic.com/en/articles/8325621-i-would-like-to-input-sensitive-data-into-free-claude-ai-or-claude-pro-who-can-view-my-conversations)
[^2]: For more information about the Model Context Protocol, see [MCP Introduction](https://modelcontextprotocol.io/introduction)
[^3]: For a list of available MCP Clients, see [MCP Example Clients](https://modelcontextprotocol.io/clients)
[^4]: Requires Obsidian plugin Local REST API
[^5]: Requires Obsidian plugin Smart Connections
[^6]: Requires Obsidian plugin Templater