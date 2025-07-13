# Contributing to MCP Tools for Obsidian

## Community Standards

This is a **free, open-source project** maintained by volunteers in their spare time. We welcome genuine contributions and constructive discussions, but we have **zero tolerance** for toxic behavior.

### Unacceptable Behavior
- Demanding features or fixes
- Rude, dismissive, or condescending language
- Entitlement or treating maintainers like paid support
- Shaming contributors for mistakes or decisions
- Aggressive or impatient language in issues or discussions

### Consequences
**One strike policy**: Any toxic, demanding, or rude behavior results in an immediate ban from both the GitHub repository and Discord server.

### Before You Post
Think before you post. Ask yourself:
- Am I being respectful and constructive?
- Would I talk this way to a volunteer helping me for free?
- Am I treating maintainers like human beings, not paid support staff?

**Remember**: We don't owe anyone anything. This is a gift to the community, and we expect contributors to act accordingly.

## Getting Help & Community

- **Discord**: [Join our community](https://discord.gg/q59pTrN9AA) for discussions and support
- **Issues**: Use GitHub issues for bug reports and feature requests (following our guidelines)
- **Discussions**: Use GitHub Discussions for questions and general help

## Development Setup

1. **Prerequisites**:
   - [Bun](https://bun.sh/) v1.1.42 or higher
   - [Obsidian](https://obsidian.md/) v1.7.7 or higher
   - [Claude Desktop](https://claude.ai/download) for testing

2. **Clone and Setup**:
   ```bash
   git clone https://github.com/jacksteamdev/obsidian-mcp-tools.git
   cd obsidian-mcp-tools
   bun install
   ```

3. **Development**:
   ```bash
   bun run dev     # Development mode with watch
   bun run build   # Production build
   bun test        # Run tests
   ```

## Project Architecture

### Documentation Resources
- **Project architecture**: `/docs/project-architecture.md`
- **Feature documentation**: `/docs/features/`
- **AI-generated docs**: [DeepWiki](https://deepwiki.com/jacksteamdev/obsidian-mcp-tools)
- **Coding standards**: `.clinerules`

### Monorepo Structure
```
packages/
├── mcp-server/        # TypeScript MCP server implementation
├── obsidian-plugin/   # Obsidian plugin (TypeScript/Svelte)
└── shared/           # Shared utilities and types
```

### Feature-Based Architecture
- Self-contained modules in `src/features/` with standardized structure
- Each feature exports a setup function for initialization
- Use ArkType for runtime type validation
- Follow patterns documented in `.clinerules`

## Contributing Guidelines

### Submitting Issues
**Before creating an issue**:
- Search existing issues to avoid duplicates
- Provide clear, detailed descriptions
- Include system information and steps to reproduce
- Be respectful and patient - remember this is volunteer work

**Good issue example**:
> **Bug Report**: MCP server fails to start on macOS 14.2
> 
> **Environment**: macOS 14.2, Obsidian 1.7.7, Claude Desktop 1.0.2
> 
> **Steps to reproduce**: 
> 1. Install plugin from Community Plugins
> 2. Click "Install Server" in settings
> 3. Server download completes but fails to start
> 
> **Expected**: Server starts and connects to Claude
> **Actual**: Error in logs: [paste error message]
> 
> **Additional context**: Logs attached, willing to test fixes

### Pull Requests
1. **Fork the repository** and create a feature branch
2. **Follow the architecture patterns** described in `/docs/project-architecture.md`
3. **Write tests** for new functionality
4. **Test thoroughly**:
   - Local Obsidian vault integration
   - MCP server functionality  
   - Claude Desktop connection
5. **Submit PR** with clear description of changes

### Code Standards
- **TypeScript strict mode** required
- **ArkType validation** for all external data
- **Error handling** with descriptive messages
- **Documentation** for public APIs
- **Follow existing patterns** in `.clinerules`

## Release Process (Maintainers Only)

### Creating Releases
1. **Version bump**: `bun run version [patch|minor|major]`
   - Automatically updates `package.json`, `manifest.json`, and `versions.json`
   - Creates git commit and tag
   - Pushes to GitHub

2. **Automated build**: GitHub Actions handles:
   - Cross-platform binary compilation
   - SLSA provenance attestation  
   - Release artifact upload
   - Security verification

3. **Release notes**: GitHub automatically generates release notes from PRs

### Maintainer Responsibilities
- **Code review**: Review PRs for quality, security, and architecture compliance
- **Issue triage**: Respond to issues and help users (when possible)
- **Release management**: Create releases following security protocols
- **Community management**: Enforce community standards
- **Documentation**: Keep docs current and comprehensive

### Access Requirements
- **GitHub**: "Maintain" or "Admin" access to repository
- **Discord**: Moderator permissions for community management
- **Time commitment**: 5-10 hours per week (15-20 during releases)

## Testing Guidelines

### Local Testing
```bash
# Unit tests
bun test

# Integration testing with local vault
# 1. Set up test Obsidian vault
# 2. Install plugin locally: `bun run build:plugin`
# 3. Test MCP server connection with Claude Desktop
# 4. Verify all features work end-to-end
```

## Security Considerations

### Binary Security
- All binaries are SLSA-attested and cryptographically signed
- Use `gh attestation verify --owner jacksteamdev <binary>` to verify integrity
- Report security issues to [jacksteamdev+security@gmail.com](mailto:jacksteamdev+security@gmail.com)

### Development Security
- **No secrets in code**: Use environment variables for API keys
- **Input validation**: Use ArkType for all external data
- **Minimal permissions**: MCP server runs with least required access
- **Audit dependencies**: Regularly update and audit npm packages

## Resources

- **GitHub Repository**: [jacksteamdev/obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools)
- **Discord Community**: [Join here](https://discord.gg/q59pTrN9AA)
- **Release History**: [GitHub Releases](https://github.com/jacksteamdev/obsidian-mcp-tools/releases)
- **Security Policy**: [SECURITY.md](SECURITY.md)
- **AI Documentation**: [DeepWiki](https://deepwiki.com/jacksteamdev/obsidian-mcp-tools)

## Questions?

Join our [Discord community](https://discord.gg/q59pTrN9AA) for questions and discussions. Please read this document thoroughly before asking questions that are already covered here.

**Remember**: Be respectful, be patient, and remember that everyone here is volunteering their time to help make this project better.
