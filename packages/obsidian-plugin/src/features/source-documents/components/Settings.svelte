<script lang="ts">
  import { onMount } from "svelte";
  import type { McpToolsPlugin } from "../../core";
  import { DEFAULT_SETTINGS, MINIMUM_PAGE_SIZE } from "../constants";
  import { SettingsManager } from "../services/settings";
  import type { SourceDocumentSettings } from "../types";
  import Toggle from "$/shared/components/Toggle.svelte";

  interface Props {
    plugin: McpToolsPlugin;
  }

  let { plugin }: Props = $props();

  let settings: SourceDocumentSettings = $state(DEFAULT_SETTINGS);
  let settingsManager: SettingsManager;
  let templaterInstalled = $state(false);

  onMount(async () => {
    settingsManager = new SettingsManager(plugin);
    settings = await settingsManager.loadSettings();
    templaterInstalled = !!settingsManager.getTemplaterPlugin();
  });

  async function handleSettingsChange() {
    await settingsManager.saveSettings(settings);
    if (settings.enabled) {
      await settingsManager.ensureSourcesDirectory();
    }
  }

  async function handleTemplateSelect() {
    const path = await settingsManager.selectTemplate();
    if (path) {
      settings.templatePath = path;
      await handleSettingsChange();
    }
  }

  async function handleDirectorySelect() {
    const path = await settingsManager.selectDirectory();
    if (path) {
      settings.sourcesDirectory = path;
      await handleSettingsChange();
    }
  }
</script>

<hr />

<div class="source-document-settings">
  {#if !templaterInstalled}
    <div class="notice warning">
      Templater plugin is required for source document features.
      <a
        href="https://github.com/SilentVoid13/Templater"
        target="_blank"
        rel="noopener">Install Templater</a
      >
    </div>
  {/if}

  <div class="setting-item">
    <div class="setting-item-info">
      <div class="setting-item-title">Source Documents</div>
      <div class="setting-item-description">
        Create and read web content as paginated Markdown documents
      </div>
    </div>
    <Toggle
      isEnabled={settings.enabled}
      onChange={(isEnabled) => {
        settings.enabled = isEnabled;
        handleSettingsChange();
      }}
    />
  </div>

  {#if settings.enabled}
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
          onchange={handleSettingsChange}
        />
        <button onclick={handleTemplateSelect} disabled={!templaterInstalled}>
          Browse
        </button>
      </div>
    </div>

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
          onchange={handleSettingsChange}
        />
        <button onclick={handleDirectorySelect}> Browse </button>
      </div>
    </div>

    <div class="setting-item">
      <div class="setting-item-info">
        <div class="setting-item-name">Maximum Page Size</div>
        <div class="setting-item-description">
          Characters per page (minimum: {MINIMUM_PAGE_SIZE})
        </div>
      </div>
      <div class="setting-item-control">
        <input
          type="number"
          min={MINIMUM_PAGE_SIZE}
          bind:value={settings.maxPageSize}
          onchange={handleSettingsChange}
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .notice {
    padding: 1em;
    margin-bottom: 1em;
    border-radius: 4px;
  }

  .notice.warning {
    background-color: var(--background-modifier-error);
    color: var(--text-error);
  }

  .setting-item {
    display: flex;
    padding: 0.75em 0;
    border-top: 1px solid var(--background-modifier-border);
  }

  .setting-item:first-child {
    border-top: none;
  }

  .setting-item-info {
    flex: 1;
    padding-right: 1em;
  }

  .setting-item-title {
    font-weight: 500;
    margin-bottom: 0.3em;
    font-size: var(--h3-size);
  }

  .setting-item-name {
    font-weight: 500;
    margin-bottom: 0.3em;
  }

  .setting-item-description {
    color: var(--text-muted);
    font-size: 0.9em;
  }

  .setting-item-control {
    display: flex;
    align-items: center;
    gap: 0.5em;
  }

  input[type="text"],
  input[type="number"] {
    background: var(--background-modifier-form-field);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    padding: 0.3em 0.5em;
    border-radius: 4px;
  }

  button {
    background: var(--interactive-normal);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
    padding: 0.3em 0.8em;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: var(--interactive-hover);
  }

  button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
