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
        ├── stores/     # Shared Svelte stores
        └── constants/  # Shared configuration
```

## Feature-Based Architecture

The Obsidian plugin uses a feature-based architecture where each feature is a self-contained module.

### Feature Structure

```
src/features/
├── core/              # Plugin initialization and settings
│   └── components/
│       └── Settings.svelte  # Main settings component
├── mcp-server-install/      # Binary management
├── mcp-server-prompts/      # Template execution
└── smart-search/            # Search functionality

Each feature contains:
feature/
├── components/       # Svelte components (.svelte files)
├── services/         # Business logic
├── types.ts          # Feature-specific types
├── utils.ts          # Feature-specific utilities
├── constants.ts      # Feature-specific constants
└── index.ts          # Public API with setup function
```

### Feature Management

Each feature exports:

- A setup function for initialization
- Svelte components for UI

```typescript
export async function setup(plugin: Plugin): Promise<SetupResult>;
export { default as FeatureSettings } from "./components/SettingsTab.svelte";
```

Features:

- Initialize independently
- Handle their own dependencies
- Continue running if other features fail
- Log failures for debugging

### Component Integration

Components follow the Obsidian Svelte integration guide (https://docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin):

- Core Settings.svelte loads feature components
- Components mount into Obsidian's DOM
- Uses Obsidian's default CSS where possible

### State Management

- Feature-specific state in local Svelte stores
- Shared state in `shared/stores`
- Settings state managed through Obsidian API

### Build Configuration

- BunJS for building and development
- Svelte compiler plugin for .svelte files
- See the [Bun Docs](https://bun.sh/docs/runtime/plugins#loaders) and [this Gist](https://gist.github.com/buhrmi/6e6d2256888d8d385d66a5f6b20a203d) for implementation details.

```typescript
// Bun plugin for Svelte compilation
plugin({
  name: "svelte-loader",
  setup(build) {
    build.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const file = await Bun.file(path).text();
      const result = compile(file, {
        filename: path,
        generate: "ssr",
      });
      // ... handle compilation
    });
  },
});
```

### Settings Management

Settings use TypeScript module augmentation:

```typescript
// shared/types/settings.ts
export interface PluginSettings {
  version: string;
}

// features/some-feature/types.ts
declare module "../../shared/types/settings" {
  interface PluginSettings {
    featureName?: {
      setting1?: string;
      setting2?: boolean;
    };
  }
}
```

### Version Management

Unified version approach:

- Plugin and server share version number
- Version stored in plugin manifest
- Server binaries include version in filename
- Version checked during initialization

### Error Handling

Features implement consistent error handling:

- Return descriptive error messages
- Log detailed information for debugging
- Provide user feedback via Obsidian Notice API
- Clean up resources on failure

## Development Workflow

1. Make changes in relevant package
2. Run BunJS scripts for development
3. Test in playground environments
4. Update documentation as needed
