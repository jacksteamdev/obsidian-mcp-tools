<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { FULL_LOGGER_FILENAME, loadDependenciesArray } from "$/shared";
  import { Notice } from "obsidian";
  import { dirname } from "path";
  import { onMount } from "svelte";
  import {
    removeFromClaudeConfig,
    updateClaudeConfig,
  } from "../services/config";
  import { installMcpServer } from "../services/install";
  import { getInstallationStatus } from "../services/status";
  import { uninstallServer } from "../services/uninstall";
  import type { InstallationStatus } from "../types";
  import { openFolder } from "../utils/openFolder";

  export let plugin: McpToolsPlugin;

  // Dependencies and API key status
  const deps = loadDependenciesArray(plugin);

  // Installation status
  let status: InstallationStatus = {
    state: "not installed",
    versions: {},
  };
  onMount(async () => {
    status = await getInstallationStatus(plugin);
  });

  // Handle installation
  async function handleInstall() {
    try {
      const apiKey = await plugin.getLocalRestApiKey();
      if (!apiKey) {
        throw new Error("Local REST API key is not configured");
      }

      status = { ...status, state: "installing" };
      const installPath = await installMcpServer(plugin);

      // Update Claude config
      await updateClaudeConfig(plugin, installPath.path, apiKey);

      status = await getInstallationStatus(plugin);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Installation failed";
      status = { ...status, state: "error", error: message };
      new Notice(message);
    }
  }

  // Handle uninstall
  async function handleUninstall() {
    try {
      status = { ...status, state: "installing" };
      await uninstallServer(plugin);
      await removeFromClaudeConfig();
      status = { ...status, state: "not installed" };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Uninstallation failed";
      status = {
        ...status,
        state: "error",
        error: message,
      };
      new Notice(message);
    }
  }
</script>

<div class="installation-status">
  <h3>Installation Status</h3>

  {#if status.state === "no api key"}
    <div class="error-message">Please configure the Local REST API plugin</div>
  {:else if status.state === "not installed"}
    <div class="status-message">
      MCP Server is not installed
      <button on:click={handleInstall}>Install Server</button>
    </div>
  {:else if status.state === "installing"}
    <div class="status-message">Installing MCP Server...</div>
  {:else if status.state === "installed"}
    <div class="status-message">
      MCP Server v{status.versions.server} is installed
      <button on:click={handleUninstall}>Uninstall</button>
    </div>
  {:else if status.state === "outdated"}
    <div class="status-message">
      Update available (v{status.versions.server} -> v{status.versions.plugin})
      <button on:click={handleInstall}>Update</button>
    </div>
  {:else if status.state === "uninstalling"}
    <div class="status-message">Uninstalling MCP Server...</div>
  {:else if status.state === "error"}
    <div class="error-message">{status.error}</div>
  {/if}
</div>

<div class="dependencies">
  <h3>Dependencies</h3>

  {#each $deps as dep (dep.id)}
    <div class="dependency-item">
      {#if dep.installed}
        ✅ {dep.name} (Installed)
      {:else}
        ❌
        {dep.name}
        {dep.required ? "(Required)" : "(Optional)"}
        {#if dep.url}<a href={dep.url} target="_blank">How to install?</a>{/if}
      {/if}
    </div>
  {/each}
</div>

<div class="links">
  <h3>Resources</h3>

  {#if status.path}
    <div class="link-item">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <a on:click={() => status.dir && openFolder(status.dir)}>
        Server Install Folder
      </a>
    </div>
  {/if}

  <div class="link-item">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <a on:click={() => openFolder(dirname(FULL_LOGGER_FILENAME))}>
      Server Log Folder
    </a>
  </div>

  <div class="link-item">
    <a
      href="https://github.com/jacksteamdev/obsidian-advanced-mcp-server"
      target="_blank"
    >
      GitHub Repository
    </a>
  </div>
</div>

<style>
  .error-message {
    color: var(--text-error);
    margin-bottom: 1em;
  }

  .status-message {
    margin-bottom: 1em;
  }

  .dependency-item {
    margin-bottom: 0.5em;
  }

  .installed {
    color: var(--text-success);
  }

  .not-installed {
    color: var(--text-muted);
  }

  .link-item {
    margin-bottom: 0.5em;
  }

  button {
    margin-left: 0.5em;
  }
</style>
