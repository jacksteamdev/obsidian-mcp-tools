# System Patterns

## Architecture Overview

### Documentation Structure

```
docs/
├── features/          # Feature-specific requirements and implementation guides
│   ├── source-document/  # Source document feature documentation
│   ├── mcp-server-install.md  # Server installation feature guide
│   └── prompt-requirements.md  # Prompt feature requirements
└── project-architecture.md  # Core architectural guidelines
```

### Feature Documentation

Each feature in docs/features/ should include:

- Overview and purpose
- Implementation requirements
- Component structure
- API specifications
- Error handling
- Testing strategy

### Monorepo Structure

```
packages/
├── mcp-server/        # Server implementation
├── obsidian-plugin/   # Obsidian plugin
└── shared/           # Shared utilities and types
```

## Feature-Based Architecture

### Feature Structure

Each feature is a self-contained module following this pattern:

```
feature/
├── components/    # Svelte UI components
├── services/     # Core business logic
├── constants/    # Feature-specific constants
├── utils.ts      # Helper functions
└── index.ts      # Public API & setup
```

### Type Organization

- All feature types defined in shared package
- Namespace-based organization (e.g., SourceDocuments)
- Clear type naming conventions:

  ```typescript
  // Example: source-documents.ts
  export namespace SourceDocuments {
    // Core types
    export type Settings = typeof settings.infer;
    export type Metadata = typeof metadata.infer;

    // Operation-specific types
    export type CreateParams = typeof createParams.infer;
    export type ReadParams = typeof readParams.infer;
    export type SearchParams = typeof searchParams.infer;

    // Response types
    export type CreateResponse = typeof createResponse.infer;
    export type ReadResponse = typeof readResponse.infer;
    export type SearchResult = typeof searchResult.infer;
  }
  ```

### Feature Management

- Independent initialization via setup function
- Self-contained dependency management
- Graceful failure handling
- Comprehensive logging

## Core Technical Patterns

### Type Safety

- ArkType for runtime validation
- TypeScript strict mode
- Type inference for configurations
- Module augmentation for plugin settings
- Namespace-based type organization
- Consistent type naming conventions

### Error Handling

- Descriptive error messages
- Contextual error logging
- Resource cleanup on failure
- User feedback via Obsidian Notice
- Async error catching
- Client-friendly error formatting

### State Management

- Svelte stores for UI state
- Settings persistence via Obsidian API
- Clean resource management
- Proper cleanup on unload

### Security

- Signed and attested binaries
- SLSA provenance verification
- Minimal permission model
- Encrypted communication
- Secure credential storage

## Development Practices

### Import Patterns

- Always import from $/shared for:
  - Components from the shared package
  - Types from shared package
  - Items from src/shared directory
  - Never import directly from long paths or specific files

### Code Style

- Functional programming preferred
- Pure functions when possible
- Single responsibility principle
- Descriptive, action-oriented naming
- Shared code in shared package
- Small, focused components

### Import Examples

```typescript
// ✅ Correct: Import from $/shared
import { logger, SourceDocuments } from "$/shared";
import { FileSelectionModal } from "$/shared/components";

// ❌ Incorrect: Don't import from specific paths
import { logger } from "../../../shared/logger";
import { SourceDocuments } from "shared/types/source-documents";
```

### Testing

- Unit tests for business logic
- Integration tests for API endpoints
- E2E tests for critical flows
- Feature isolation testing
- Accessibility testing

### Build System

- Bun for building/testing
- Reproducible builds via GitHub Actions
- Version synchronization between components
- Automated binary signing and attestation
