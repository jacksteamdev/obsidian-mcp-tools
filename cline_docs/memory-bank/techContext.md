# Technical Context

## Technologies
1. Core
   - TypeScript (strict mode)
   - Svelte
   - Obsidian API
   - Model Context Protocol (MCP)
   - DQL (Dataview Query Language)

2. Build & Development
   - Bun
   - ESLint
   - Prettier

3. Testing
   - Unit tests for business logic
   - Integration tests for API endpoints
   - E2E tests for critical flows

## Development Setup
1. Project Structure
   ```
   packages/
   ├── mcp-server/        # Server implementation
   ├── obsidian-plugin/   # Obsidian plugin
   └── shared/           # Shared utilities and types
   ```

2. Key Files
   - package.json: Project configuration
   - tsconfig.json: TypeScript settings
   - .clinerules: Project guidelines

## Technical Constraints
1. Type Safety
   - Must use ArkType for runtime validation
   - Strict TypeScript configuration
   - Proper type definitions

2. Error Handling
   - Comprehensive error messages
   - Proper resource cleanup
   - User-friendly notifications

3. Documentation
   - Update docs for feature changes
   - Maintain changelog
   - Document type definitions

4. DQL Integration
   - Use /search/ endpoint for queries
   - Proper query construction
   - Handle query errors gracefully
   - Validate and sanitize inputs
