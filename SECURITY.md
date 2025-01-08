# Security Policy

## Reporting a Vulnerability

The Advanced MCP Server for Obsidian team takes security vulnerabilities seriously. If you discover a security issue, please report it by emailing [jacksteamdev+security@gmail.com]. 

**Please do not report security vulnerabilities through public GitHub issues.**

When reporting a vulnerability, please include:
- Description of the issue
- Steps to reproduce
- Potential impact
- Any suggested fixes (if you have them)

You should receive a response within 48 hours. If for some reason you do not, please follow up via email to ensure we received your original message.

## Disclosure Policy

When we receive a security bug report, we will:
1. Confirm the problem and determine affected versions
2. Audit code to find any similar problems
3. Prepare fixes for all supported releases
4. Release new versions and notify users

## Binary Distribution Security

The Advanced MCP Server for Obsidian uses several measures to ensure secure binary distribution:

1. **SLSA Provenance**: All binaries are built using GitHub Actions with [SLSA Level 3](https://slsa.dev) provenance attestation
2. **Reproducible Builds**: Our build process is deterministic and can be reproduced from source
3. **Verification**: Users can verify binary authenticity using:
   ```bash
   gh attestation verify --owner jacksteamdev <binary_path>
   ```

## Runtime Security Model

The MCP server operates with the following security principles:

1. **Minimal Permissions**: 
   - Operates only in user space
   - Requires access only to:
     - Obsidian vault directory
     - Claude Desktop configuration
     - System logging directory

2. **API Security**:
   - All communication is encrypted
   - Input validation and sanitization

3. **Data Privacy**:
   - No telemetry collection
   - No external network calls except to Claude Desktop
   - All processing happens locally

## Dependencies

We regularly monitor and update our dependencies for security vulnerabilities:
- Automated security scanning with GitHub Dependabot
- Regular dependency audits
- Prompt patching of known vulnerabilities

## Security Update Policy

- Critical vulnerabilities: Patch within 24 hours
- High severity: Patch within 7 days
- Other vulnerabilities: Address in next release

## Supported Versions

We provide security updates for:
- Current major version: Full support
- Previous major version: Critical security fixes only

## Best Practices for Users

1. **Binary Verification**:
   - Always verify downloaded binaries using GitHub's attestation tools
   - Check release signatures and hashes
   - Download only from official GitHub releases

2. **Configuration**:
   - Use unique API keys
   - Regularly update to the latest version
   - Monitor plugin settings for unexpected changes

3. **Monitoring**:
   - Check logs for unusual activity
   - Review Claude Desktop configuration changes
   - Keep track of plugin updates

## Security Acknowledgments

We would like to thank the following individuals and organizations for responsibly disclosing security issues:

- [To be added as vulnerabilities are reported and fixed]

## License

This security policy is licensed under [MIT License](LICENSE).