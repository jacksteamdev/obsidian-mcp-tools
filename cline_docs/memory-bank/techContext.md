# Technical Context

## Core Technologies

### Languages & Frameworks
- TypeScript (strict mode)
- Svelte for UI components
- Bun for runtime and package management

### Development Tools
- GitHub Actions for CI/CD
- SLSA for build provenance
- VSCode as primary IDE

## Project Requirements

### Version Requirements
- Obsidian v1.7.7+
- Bun v1.1.42+
- TypeScript 5.0+

### Required Plugins
- Local REST API plugin
  - Required for vault access
  - Must be configured with API key
- Templater (recommended)
  - Enhances template functionality
- Smart Connections (recommended)
  - Enables semantic search

## Development Setup

### Installation
```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Development mode
bun run dev
```

### Project Structure
- Monorepo using Bun workspaces
- Feature-based architecture
- Shared utilities in common package

## Technical Constraints

### Security Requirements
- Server runs with minimal permissions
- All communication must be encrypted
- API keys stored in secure credential storage
- Binaries must be signed and verified

### Platform Support
- Cross-platform compatibility required
- Platform-specific binary distribution
- Different installation paths per OS:
  - macOS: ~/Library/Logs/Claude
  - Windows: %APPDATA%\Claude\logs
  - Linux: ~/.local/share/Claude/logs

### Integration Points
- Obsidian API for vault operations
- Local REST API for external access
- Smart Connections for search
- Templater for template execution
- Claude Desktop for AI integration

## Build & Distribution

### Build Process
- Reproducible builds via GitHub Actions
- Binary signing and attestation
- Version synchronization across packages
- Automated release workflow

### Testing Requirements
- Unit tests for core logic
- Integration tests for API
- E2E tests for critical paths
- Feature isolation testing
