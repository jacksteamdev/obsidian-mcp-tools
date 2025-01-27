# System Patterns

## Architecture
1. Modular Feature Structure
   ```
   feature/
   ├── components/    # Svelte UI components
   ├── services/     # Core business logic
   ├── constants/    # Feature-specific constants
   ├── types.ts      # Types and interfaces
   ├── utils.ts      # Helper functions
   └── index.ts      # Public API & setup
   ```

2. Feature Setup Pattern
   - Export setup function returning success/error
   - Handle dependencies and cleanup
   - Use Svelte stores for UI state
   - Persist settings via Obsidian API

3. Type Safety
   - Use ArkType for runtime validation
   - Define types with inference
   - Validate external data
   - Add descriptive error messages

## Key Technical Decisions
1. Functional Programming Preference
   - Pure functions when possible
   - Small, focused components
   - Clear separation of concerns

2. Error Handling
   - Return descriptive messages
   - Log with full context
   - Clean up on failure
   - Use Obsidian Notice for user feedback

3. Integration Patterns
   - Obsidian API for vault access
   - Local REST API for communication
   - Smart Connections for search
   - Templater for templates

## Development Patterns
1. TypeScript strict mode
2. Bun for building/testing
3. Feature isolation
4. Comprehensive documentation
