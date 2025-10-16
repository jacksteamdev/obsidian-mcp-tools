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

  // Check authentication configuration
  let hasApiKey = false;
  let hasOAuth = false;

  onMount(async () => {
    // Check for API key
    const apiKey = await plugin.getLocalRestApiKey();
    hasApiKey = !!apiKey;

    // Check for OAuth credentials
    const oauthClientId = process.env.OAUTH_CLIENT_ID;
    const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
    const oauthTokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT;
    hasOAuth = !!(oauthClientId && oauthClientSecret && oauthTokenEndpoint);
  });

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

      // Check for OAuth credentials from environment variables
      const oauthClientId = process.env.OAUTH_CLIENT_ID;
      const oauthClientSecret = process.env.OAUTH_CLIENT_SECRET;
      const oauthTokenEndpoint = process.env.OAUTH_TOKEN_ENDPOINT;

      const hasOAuth = oauthClientId && oauthClientSecret && oauthTokenEndpoint;

      // Require either API key or OAuth credentials
      if (!apiKey && !hasOAuth) {
        throw new Error("Either Local REST API key or OAuth credentials (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_TOKEN_ENDPOINT) must be configured");
      }

      status = { ...status, state: "installing" };
      const installPath = await installMcpServer(plugin);

      // Update Claude config with auth configuration
      await updateClaudeConfig(plugin, installPath.path, {
        apiKey,
        oauth: hasOAuth ? {
          clientId: oauthClientId!,
          clientSecret: oauthClientSecret!,
          tokenEndpoint: oauthTokenEndpoint!,
        } : undefined,
      });

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

<div class="authentication-status">
  <h3>Authentication Configuration</h3>

  {#if hasApiKey && hasOAuth}
    <div class="status-message">
      ✅ API Key configured<br />
      ✅ OAuth configured (will be preferred)
    </div>
  {:else if hasApiKey}
    <div class="status-message">✅ API Key configured</div>
  {:else if hasOAuth}
    <div class="status-message">✅ OAuth configured</div>
  {:else}
    <div class="error-message">
      ❌ No authentication configured. Please configure either:
      <ul>
        <li>Local REST API key in the Local REST API plugin, or</li>
        <li>OAuth credentials via environment variables (OAUTH_CLIENT_ID, OAUTH_CLIENT_SECRET, OAUTH_TOKEN_ENDPOINT)</li>
      </ul>
    </div>
  {/if}
</div>

<div class="installation-status">
  <h3>Installation status</h3>

  {#if status.state === "no api key"}
    <div class="error-message">Please configure the Local REST API plugin</div>
  {:else if status.state === "not installed"}
    <div class="status-message">
      MCP Server is not installed
      <button on:click={handleInstall}>Install server</button>
    </div>
  {:else if status.state === "installing"}
    <div class="status-message">Installing MCP server...</div>
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
    <div class="status-message">Uninstalling MCP server...</div>
  {:else if status.state === "error"}
    <div class="error-message">{status.error}</div>
  {/if}
</div>

<div class="dependencies">
  <h3>Dependencies</h3>

  {#each $deps as dep (dep.id)}
    <div class="dependency-item">
      {#if dep.installed}
        ✅ {dep.name} is installed
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
        Server install folder
      </a>
    </div>
  {/if}

  <div class="link-item">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <a on:click={() => openFolder(dirname(FULL_LOGGER_FILENAME))}>
      Server log folder
    </a>
  </div>

  <div class="link-item">
    <a
      href="https://github.com/jacksteamdev/obsidian-mcp-tools"
      target="_blank"
    >
      GitHub repository
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
