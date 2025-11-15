# MCP Tools for Obsidian - Server

A secure Model Context Protocol (MCP) server that provides authenticated access to Obsidian vaults. This server implements MCP endpoints for accessing notes, executing templates, and performing semantic search through Claude Desktop and other MCP clients.

## Features

### Resource Access

- Read and write vault files via `note://` URIs
- Access file metadata and frontmatter
- Semantic search through Smart Connections
- Template execution via Templater

### Security

- Binary attestation with SLSA provenance
- Encrypted communication via Local REST API
- Platform-specific credential storage
- Minimal required permissions

### Tools

- File operations (create, read, update, delete)
- Semantic search with filters
- Template execution with parameters
- Vault directory listing

## Installation

The server is typically installed automatically through the Obsidian plugin. For manual installation:

```bash
# Install dependencies
bun install

# Build the server
bun run build
```

````

### Configuration

Server configuration is managed through Claude Desktop's config file:

On macOS:

```json
// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "obsidian-mcp-tools": {
      "command": "/path/to/mcp-server",
      "env": {
        "OBSIDIAN_API_KEY": "your-api-key",
        "OBSIDIAN_HTTP_PORT": "27123",     // Optional: Custom HTTP port (default: 27123)
        "OBSIDIAN_HTTPS_PORT": "27124",    // Optional: Custom HTTPS port (default: 27124)
        "OBSIDIAN_HOST": "127.0.0.1"       // Optional: Custom host (default: 127.0.0.1)
      }
    }
  }
}
```

#### Environment Variables

- `OBSIDIAN_API_KEY` (required): Your Local REST API plugin API key
- `OBSIDIAN_HTTP_PORT` (optional): Custom HTTP port (default: 27123)
- `OBSIDIAN_HTTPS_PORT` (optional): Custom HTTPS port (default: 27124)
- `OBSIDIAN_HOST` (optional): Custom host address (default: 127.0.0.1)
- `OBSIDIAN_USE_HTTP` (optional): Use HTTP instead of HTTPS (default: false)

## Development

```bash
# Start development server with auto-reload
bun run dev

# Run tests
bun test

# Build for all platforms
bun run build:all

# Use MCP Inspector for debugging
bun run inspector
```

### Project Structure

```
src/
├── features/           # Feature modules
│   ├── core/          # Server core
│   ├── fetch/         # Web content fetching
│   ├── local-rest-api/# API integration
│   ├── prompts/       # Prompt handling
│   └── templates/     # Template execution
├── shared/            # Shared utilities
└── types/             # TypeScript types
```

### Binary Distribution

Server binaries are published with SLSA Provenance attestations. To verify a binary:

```bash
gh attestation verify --owner jacksteamdev <binary>
```

This verifies:

- Binary's SHA256 hash
- Build origin from this repository
- Compliance with SLSA Level 3

## Protocol Implementation

### Resources

- `note://` - Vault file access
- `template://` - Template execution
- `search://` - Semantic search

### Tools

- `create_note` - Create new files
- `update_note` - Modify existing files
- `execute_template` - Run Templater templates
- `semantic_search` - Smart search integration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Update documentation
5. Submit a pull request

See [CONTRIBUTING.md](../CONTRIBUTING.md) for detailed guidelines.

## Security

For security issues, please:

1. **DO NOT** open a public issue
2. Email [jacksteamdev+security@gmail.com](mailto:jacksteamdev+security@gmail.com)
3. Follow responsible disclosure practices

## License

[MIT License](LICENSE)
````
