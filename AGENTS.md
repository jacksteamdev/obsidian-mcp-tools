Use `bd` (beads) for all new work. DO NOT USE MARKDOWN TO TRACK ISSUES.

# Project Architecture

## Structure

```
packages/
├── mcp-server/        # Server implementation
├── obsidian-plugin/   # Obsidian plugin
└── shared/           # Shared utilities and types
```

## Features

- Self-contained modules in src/features/ with structure:

```
feature/
├── components/    # Svelte UI components
├── services/     # Core business logic
├── constants/    # Feature-specific constants
├── types.ts      # Types and interfaces
├── utils.ts      # Helper functions
└── index.ts      # Public API & setup
```

- feature/index.ts exports a setup function:

  - `function setup(plugin: McpToolsPlugin): { success: true } | { success: false, error: string }`

- Handle dependencies and state:

  - Check dependencies on setup
  - Use Svelte stores for UI state
  - Persist settings via Obsidian API
  - Clean up on unload/errors

- Extend plugin settings:

```typescript
// features/some-feature/types.ts
declare module "obsidian" {
  interface McpToolsPluginSettings {
    featureName?: {
      setting1?: string;
      setting2?: boolean;
    };
  }
}
```

- Export UI components:

```typescript
// index.ts
export { default as FeatureSettings } from "./components/SettingsTab.svelte";
export * from "./constants";
export * from "./types";
```

## Error Handling

- Return descriptive error messages
- Log errors with full context
- Clean up resources on failure
- Use Obsidian Notice for user feedback
- Catch and handle async errors
- Format errors for client responses

## Type Safety

- Use ArkType for runtime validation
- Define types with inference:

```typescript
const schema = type({
  name: "string",
  required: "boolean?",
  config: {
    maxSize: "number",
    mode: "'strict'|'loose'",
  },
});
type Config = typeof schema.infer;
```

- Validate external data:

```typescript
const result = schema(untrustedData);
if (result instanceof type.errors) {
  throw new Error(result.summary);
}
```

- Pipe transformations:

```typescript
const transformed = type("string.json.parse")
  .pipe(searchSchema)
  .to(parametersSchema);
```

- Add descriptions for better errors:

```typescript
type({
  query: type("string>0").describe("Search text cannot be empty"),
  limit: type("number>0").describe("Result limit must be positive"),
});
```

## Development

- Write in TypeScript strict mode
- Use Bun for building/testing
- Test features in isolation

## Core Integrations

- Obsidian API for vault access
- Obsidian plugins
  - Local REST API for communication
  - Smart Connections for search
  - Templater for templates

## Coding Style

- Prefer functional over OOP
- Use pure functions when possible
- Keep files focused on single responsibility
- Use descriptive, action-oriented names
- Place shared code in shared package
- Keep components small and focused

# Project Guidelines

## Documentation Requirements

- Update relevant documentation in /docs when modifying features
- Keep README.md in sync with new capabilities
- Maintain changelog entries in CHANGELOG.md

## Testing Standards

- Unit tests required for business logic
- Integration tests for API endpoints
- E2E tests for critical user flows
