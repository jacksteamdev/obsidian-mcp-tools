# Project Architecture

## Monorepo Structure
This project uses a monorepo with multiple packages:
- `packages/mcp-server` - The MCP server implementation
- `packages/obsidian-plugin` - The Obsidian plugin
- `packages/shared` - Shared code between packages

### Package Organization
```
packages/
├── mcp-server/           # Server implementation
│   ├── dist/            # Compiled output
│   ├── logs/           # Server logs
│   ├── playground/     # Development testing
│   ├── scripts/        # Build and utility scripts
│   └── src/            # Source code
│
├── obsidian-plugin/     # Obsidian plugin
│   ├── docs/           # Documentation
│   ├── src/
│   │   ├── features/   # Feature modules
│   │   └── main.ts     # Plugin entry point
│   └── manifest.json   # Plugin metadata
│
└── shared/             # Shared utilities and types
    └── src/
        ├── types/      # Common interfaces
        ├── utils/      # Common utilities
        └── constants/  # Shared configuration
```

## Feature-Based Architecture
The Obsidian plugin uses a feature-based architecture where each feature is a self-contained module.

### Feature Structure
```
src/features/
├── core/                # Plugin initialization and settings
├── mcp-server-install/ # Binary management
├── mcp-server-prompts/ # Template execution
└── smart-search/       # Search functionality

Each feature contains:
feature/
├── components/    # UI components
├── services/     # Business logic
├── types.ts      # Feature-specific types
├── utils.ts      # Feature-specific utilities
├── constants.ts  # Feature-specific constants
└── index.ts      # Public API with setup function
```

### Feature Management
Each feature exports a setup function for initialization:
```typescript
export async function setup(plugin: Plugin): Promise<SetupResult> {
  // Check dependencies
  // Initialize services
  // Register event handlers
  return { success: true } || { success: false, error: 'reason' };
}
```

Features:
- Initialize independently
- Handle their own dependencies
- Continue running if other features fail
- Log failures for debugging

### Settings Management
Settings use TypeScript module augmentation:
```typescript
// shared/types/settings.ts
export interface PluginSettings {
  version: string;
}

// features/some-feature/types.ts
declare module '../../shared/types/settings' {
  interface PluginSettings {
    featureName?: {
      setting1?: string;
      setting2?: boolean;
    }
  }
}
```

### Version Management
Unified version approach:
- Plugin and server share version number
- Version stored in plugin manifest
- Server binaries include version in filename
- Version checked during initialization

### UI Integration
The core feature provides a PluginSettingTab that:
- Loads UI components from each feature
- Maintains consistent UI organization
- Handles conditional rendering based on feature state

### Error Handling
Features implement consistent error handling:
- Return descriptive error messages
- Log detailed information for debugging
- Provide user feedback via Obsidian Notice API
- Clean up resources on failure

## Development Workflow
1. Make changes in relevant package
2. Run build scripts if needed
3. Test in playground environments
4. Update documentation as needed

## Build Configuration
- TypeScript configuration in each package
- ESBuild for Obsidian plugin bundling
- Version management through versions.json
- Shared tsconfig settings where appropriate