# Source Document Settings Implementation

## Overview

The settings stage implements the configuration UI and state management for the source document feature.

## Implementation Location

```
packages/obsidian-plugin/src/features/source-document/
├── components/
│   └── Settings.svelte       # Settings UI component
├── services/
│   └── settings.ts          # Settings management
├── constants.ts             # Default values
└── types.ts                # Type definitions
```

## Settings Schema

```typescript
// types.ts
import { type } from "arktype";

export const sourceDocumentSettingsSchema = type({
  "enabled": "boolean",
  "templatePath": type("string").describe(
    "Path to Templater template file"
  ),
  "sourcesDirectory": type("string").describe(
    "Directory to store source documents"
  ),
  "maxPageSize": type("number>0").describe(
    "Maximum characters per page"
  ),
});

export type SourceDocumentSettings = typeof sourceDocumentSettingsSchema.infer;

// constants.ts
export const DEFAULT_SETTINGS: SourceDocumentSettings = {
  enabled: false,
  templatePath: "",
  sourcesDirectory: "Sources",
  maxPageSize: 5000,
};
```

## Settings UI Component

```typescript
// components/Settings.svelte
<script lang="ts">
  import { App, PluginSettingTab, Setting } from "obsidian";
  import { onMount } from "svelte";
  import type { SourceDocumentSettings } from "../types";
  
  export let settings: SourceDocumentSettings;
  export let onSettingsChange: (settings: SourceDocumentSettings) => void;
  
  let templaterInstalled = false;
  
  onMount(async () => {
    templaterInstalled = app.plugins.plugins["templater-obsidian"] !== undefined;
  });
</script>

<div class="source-document-settings">
  {#if !templaterInstalled}
    <div class="notice">
      Templater plugin is required for source document features.
      <a href="https://github.com/SilentVoid13/Templater">Install Templater</a>
    </div>
  {/if}

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Enable Source Documents</div>
      <div class="setting-item-description">
        Create and read web content as paginated Markdown documents
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="checkbox"
        bind:checked={settings.enabled}
        on:change={() => onSettingsChange(settings)}
      />
    </div>
  </div>

  <!-- Template Selection -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Source Document Template</div>
      <div class="setting-item-description">
        Select a Templater template for new source documents
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        spellcheck={false}
        placeholder="template.md"
        bind:value={settings.templatePath}
        on:change={() => onSettingsChange(settings)}
      />
      <button on:click={() => selectTemplate()}>Browse</button>
    </div>
  </div>

  <!-- Sources Directory -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Sources Directory</div>
      <div class="setting-item-description">
        Location to store source documents
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="text"
        spellcheck={false}
        placeholder="Sources"
        bind:value={settings.sourcesDirectory}
        on:change={() => onSettingsChange(settings)}
      />
      <button on:click={() => selectDirectory()}>Browse</button>
    </div>
  </div>

  <!-- Max Page Size -->
  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-name">Maximum Page Size</div>
      <div class="setting-item-description">
        Characters per page (minimum: 1000)
      </div>
    </div>
    <div class="setting-item-control">
      <input
        type="number"
        min="1000"
        bind:value={settings.maxPageSize}
        on:change={() => onSettingsChange(settings)}
      />
    </div>
  </div>
</div>
```

## Settings Management

```typescript
// services/settings.ts
import { type } from "arktype";
import { Notice } from "obsidian";
import { DEFAULT_SETTINGS, sourceDocumentSettingsSchema } from "../constants";
import type { SourceDocumentSettings } from "../types";

export class SettingsManager {
  constructor(
    private plugin: Plugin,
    private settings: SourceDocumentSettings = DEFAULT_SETTINGS
  ) {}

  async loadSettings() {
    const loaded = await this.plugin.loadData();
    const result = sourceDocumentSettingsSchema(loaded);
    
    if (result instanceof type.errors) {
      new Notice("Invalid source document settings, using defaults");
      console.error("Settings validation failed:", result.summary);
      return DEFAULT_SETTINGS;
    }
    
    return { ...DEFAULT_SETTINGS, ...result };
  }

  async saveSettings(settings: SourceDocumentSettings) {
    const result = sourceDocumentSettingsSchema(settings);
    
    if (result instanceof type.errors) {
      new Notice("Invalid settings, changes not saved");
      console.error("Settings validation failed:", result.summary);
      return false;
    }
    
    await this.plugin.saveData(settings);
    this.settings = settings;
    return true;
  }

  getSettings(): SourceDocumentSettings {
    return this.settings;
  }
}
```

## Error Handling

1. Settings Validation:
   - Use ArkType for runtime validation
   - Show user-friendly notices for validation failures
   - Log detailed validation errors for debugging
   - Fallback to defaults for invalid settings

2. Plugin Dependencies:
   - Check Templater plugin availability
   - Show clear installation instructions if missing
   - Disable relevant UI elements when dependencies unavailable

3. File System:
   - Validate template file exists
   - Create sources directory if missing
   - Handle permission errors
   - Show clear error messages for file system issues

## Implementation Steps

1. Create Feature Structure:
   ```bash
   mkdir -p packages/obsidian-plugin/src/features/source-document/{components,services,constants}
   ```

2. Add Types:
   - Define settings schema
   - Add runtime validation
   - Export type definitions

3. Add Settings UI:
   - Create Svelte component
   - Add validation feedback
   - Handle dependency checks

4. Add Settings Service:
   - Implement settings manager
   - Add load/save methods
   - Add validation handling

5. Update Plugin:
   - Register settings tab
   - Initialize settings
   - Handle settings changes
