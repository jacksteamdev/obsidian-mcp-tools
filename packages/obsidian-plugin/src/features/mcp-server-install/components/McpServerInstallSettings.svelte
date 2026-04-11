<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { FULL_LOGGER_FILENAME, loadDependenciesArray } from "$/shared";
  import { Notice } from "obsidian";
  import { dirname } from "path";
  import { onMount } from "svelte";
  import { serializeDisabledToolsToEnv } from "../../tool-toggle";
  import {
    BINARY_NAME,
    type Arch,
    type Platform,
  } from "../constants";
  import {
    removeFromClaudeConfig,
    updateClaudeConfig,
  } from "../services/config";
  import {
    installMcpServer,
    migrateFromVaultToSystem,
  } from "../services/install";
  import {
    detectLegacyVaultBinary,
    getInstallationStatus,
  } from "../services/status";
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

  // Platform override (advanced) — empty string means "auto-detect".
  // `select` elements cannot bind to `undefined`, so we round-trip
  // the absent state through "" and translate at save time.
  let overridePlatform: "" | Platform = "";
  let overrideArch: "" | Arch = "";
  let savingPlatform = false;

  // Installation location (issue #28). UI-friendly value: never
  // undefined. "system" is the new default (outside vault);
  // "vault" is the legacy opt-in.
  let installLocation: "system" | "vault" = "system";

  // Non-null when a legacy binary is detected inside the vault,
  // regardless of the current installLocation setting — drives the
  // migration banner for existing users upgrading from the old
  // default.
  let legacyBinary: { path: string; version?: string } | null = null;

  // Migration flow UI state
  let migrating = false;
  let showMigrateConfirm = false;

  // Derived: expected binary filename for the currently-saved
  // platform setting, so the banner can compare it against what is
  // actually on disk (status.name is populated by getInstallPath).
  $: expectedBinaryName =
    overridePlatform === ""
      ? undefined
      : BINARY_NAME[overridePlatform];

  // Show the banner when the user has an explicit platform override
  // AND the current installation state would not yield a working
  // server for that platform. Two cases:
  //
  // 1. (pre-save preview) A binary is installed but its filename
  //    does not match what the override would install next.
  // 2. (post-save / first install) No binary is installed at all
  //    for the chosen platform — which happens right after saving
  //    an override because `getInstallPath` now targets a file name
  //    that does not exist on disk yet.
  //
  // The banner stays silent for the 95% of users who never touch
  // the override: `overridePlatform === ""` short-circuits both
  // cases.
  $: platformNeedsAction =
    overridePlatform !== "" &&
    ((status.state === "installed" &&
      status.name !== undefined &&
      expectedBinaryName !== undefined &&
      status.name !== expectedBinaryName) ||
      status.state === "not installed");

  onMount(async () => {
    status = await getInstallationStatus(plugin);
    const data = await plugin.loadData();
    overridePlatform = data?.platformOverride?.platform ?? "";
    overrideArch = data?.platformOverride?.arch ?? "";
    installLocation = data?.installLocation ?? "system";
    legacyBinary = await detectLegacyVaultBinary(plugin);
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

      // Forward any user-configured disabled tools to the freshly
      // installed server via the OBSIDIAN_DISABLED_TOOLS env var.
      // Empty/missing list → no env var is written.
      const data = await plugin.loadData();
      const disabled = data?.toolToggle?.disabled ?? [];
      const envOverrides: Record<string, string> = {};
      const serialized = serializeDisabledToolsToEnv(disabled);
      if (serialized) envOverrides.OBSIDIAN_DISABLED_TOOLS = serialized;

      // Update Claude config
      await updateClaudeConfig(
        plugin,
        installPath.path,
        apiKey,
        envOverrides,
      );

      status = await getInstallationStatus(plugin);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Installation failed";
      status = { ...status, state: "error", error: message };
      new Notice(message);
    }
  }

  // Save the platform override. We intentionally do NOT auto-trigger
  // a reinstall here — the failure modes of a half-finished download
  // (old binary deleted, new binary never arrived) are worse than
  // the extra click the user has to make on the "Reinstall" button.
  // Instead the banner (see template below) points them at the
  // existing Reinstall button after a mismatch is detected.
  async function handlePlatformSave() {
    savingPlatform = true;
    try {
      const data = (await plugin.loadData()) ?? {};

      // Empty selection means "clear the override". Delete the key
      // entirely rather than leaving `{}` behind, so data.json stays
      // tidy (same convention as tool-toggle settings).
      if (overridePlatform === "" && overrideArch === "") {
        delete data.platformOverride;
      } else {
        data.platformOverride = {
          ...(overridePlatform !== "" && { platform: overridePlatform }),
          ...(overrideArch !== "" && { arch: overrideArch }),
        };
      }
      await plugin.saveData(data);

      // Refresh status so the banner recomputes against the new
      // override. getInstallPath now reads the setting we just wrote.
      status = await getInstallationStatus(plugin);

      new Notice("Platform preference saved.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save platform preference";
      new Notice(message);
    } finally {
      savingPlatform = false;
    }
  }

  // Persist the installation location choice and refresh downstream
  // state (status + legacy detection) so any warning banners update
  // immediately. No binary is moved here — the user is opting into
  // a new default and can trigger the actual migration explicitly
  // via the banner's "Migrate now" button.
  async function handleInstallLocationChange() {
    try {
      const data = (await plugin.loadData()) ?? {};
      if (installLocation === "system") {
        // Keep data.json tidy: undefined is semantically the same
        // as "system" (the new default), same convention used by
        // handlePlatformSave when the override is cleared.
        delete data.installLocation;
      } else {
        data.installLocation = "vault";
      }
      await plugin.saveData(data);

      status = await getInstallationStatus(plugin);
      legacyBinary = await detectLegacyVaultBinary(plugin);

      new Notice("Installation location saved.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save installation location";
      new Notice(message);
    }
  }

  // Invoked from the confirmation dialog's "Migrate now" button.
  // Delegates the full migration flow to the backend: it saves the
  // setting, downloads the new binary, rewrites the client config,
  // removes the old binary, and rolls back the setting on error.
  // The caller only needs to refresh UI state and surface Notices.
  async function handleMigrateConfirm() {
    showMigrateConfirm = false;
    migrating = true;
    try {
      await migrateFromVaultToSystem(plugin);
      status = await getInstallationStatus(plugin);
      legacyBinary = await detectLegacyVaultBinary(plugin);
      new Notice("Migration complete.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Migration failed";
      new Notice(message);
    } finally {
      migrating = false;
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

<div class="installation-location">
  <h3>Installation location</h3>
  <p class="description">
    The server binary can be installed outside your vault
    (<strong>recommended</strong> — avoids syncing a 15+ MB binary
    with iCloud, Git, Dropbox) or inside your vault (legacy default).
  </p>

  <div class="radio-group">
    <label>
      <input
        type="radio"
        bind:group={installLocation}
        value="system"
        on:change={handleInstallLocationChange}
        disabled={migrating}
      />
      Outside vault (recommended)
    </label>
    <label>
      <input
        type="radio"
        bind:group={installLocation}
        value="vault"
        on:change={handleInstallLocationChange}
        disabled={migrating}
      />
      Inside vault (legacy)
    </label>
  </div>

  {#if legacyBinary !== null && installLocation !== "vault"}
    <div class="migration-banner">
      ⚠️ A server binary was found inside your vault
      (<code>{legacyBinary.path}</code>{#if legacyBinary.version}, version
        {legacyBinary.version}{/if}). Installing the server inside the
      vault is the old default and can cause problems with vault sync
      (iCloud, Git, Dropbox). We recommend moving it outside the vault.
      <div class="banner-actions">
        <button
          on:click={() => (showMigrateConfirm = true)}
          disabled={migrating}
        >
          {migrating ? "Migrating..." : "Migrate now"}
        </button>
      </div>
    </div>
  {/if}
</div>

<details class="advanced-platform">
  <summary>Advanced — Server binary platform</summary>
  <p class="description">
    Leave this on <strong>Auto-detect</strong> unless you're running
    Obsidian under WSL, Bottles, wine, or another translation layer
    and need a binary for a different target OS. Changing the
    platform does <em>not</em> automatically reinstall the server —
    after saving, click <strong>Install server</strong> or
    <strong>Update</strong> above to download the matching binary.
  </p>

  <div class="platform-row">
    <label>
      Platform
      <select bind:value={overridePlatform} disabled={savingPlatform}>
        <option value="">Auto-detect</option>
        <option value="linux">Linux</option>
        <option value="macos">macOS</option>
        <option value="windows">Windows</option>
      </select>
    </label>

    <label>
      Architecture
      <select bind:value={overrideArch} disabled={savingPlatform}>
        <option value="">Auto-detect</option>
        <option value="x64">x64</option>
        <option value="arm64">arm64</option>
      </select>
    </label>
  </div>

  <div class="actions">
    <button on:click={handlePlatformSave} disabled={savingPlatform}>
      {savingPlatform ? "Saving..." : "Save platform preference"}
    </button>
  </div>

  {#if platformNeedsAction}
    <div class="warning-banner">
      {#if status.state === "installed"}
        ⚠️ The currently installed server binary
        (<code>{status.name}</code>) does not match the selected
        platform (expected <code>{expectedBinaryName}</code>). Click
        <strong>Install server</strong> or <strong>Update</strong>
        above to download the matching binary.
      {:else}
        ⚠️ No server binary is installed for the selected platform
        (expected <code>{expectedBinaryName}</code>). Click
        <strong>Install server</strong> above to download it.
      {/if}
    </div>
  {/if}
</details>

{#if showMigrateConfirm}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="modal-backdrop"
    on:click={() => (showMigrateConfirm = false)}
    role="presentation"
  >
    <div
      class="modal-dialog"
      on:click|stopPropagation
      role="dialog"
      aria-modal="true"
      aria-labelledby="migrate-dialog-title"
    >
      <h3 id="migrate-dialog-title">Migrate binary?</h3>
      <p>This will:</p>
      <ol>
        <li>
          Download a fresh copy of the MCP server binary to a system
          location outside your vault.
        </li>
        <li>Update your MCP client config to point at the new path.</li>
        <li>
          Delete the old binary at
          <code>{legacyBinary?.path}</code>.
        </li>
      </ol>
      <p>
        <strong>This cannot be undone automatically.</strong>
        If the download fails, your current binary will be left in place
        and the setting will be rolled back.
      </p>
      <div class="modal-actions">
        <button on:click={() => (showMigrateConfirm = false)}>Cancel</button>
        <button class="primary" on:click={handleMigrateConfirm}>
          Migrate now
        </button>
      </div>
    </div>
  </div>
{/if}

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

  .advanced-platform {
    margin-top: 2em;
  }

  .advanced-platform summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.9em;
  }

  .advanced-platform .description {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-top: 0.5em;
    margin-bottom: 1em;
  }

  .platform-row {
    display: flex;
    gap: 1em;
    flex-wrap: wrap;
    margin-bottom: 0.75em;
  }

  .platform-row label {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    font-size: 0.85em;
    color: var(--text-muted);
  }

  .platform-row select {
    font-family: var(--font-monospace);
  }

  .actions {
    margin-top: 0.5em;
    margin-bottom: 1em;
  }

  .warning-banner {
    margin-top: 0.75em;
    padding: 0.75em;
    border-left: 3px solid var(--text-warning, #e1a800);
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 0.9em;
  }

  .warning-banner code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
  }

  .installation-location {
    margin-top: 2em;
  }

  .installation-location h3 {
    margin-bottom: 0.3em;
  }

  .installation-location .description {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-bottom: 0.75em;
  }

  .radio-group {
    display: flex;
    flex-direction: column;
    gap: 0.4em;
    margin-bottom: 0.75em;
  }

  .radio-group label {
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.4em;
  }

  .migration-banner {
    margin-top: 0.75em;
    padding: 0.75em;
    border-left: 3px solid var(--text-warning, #e1a800);
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 0.9em;
  }

  .migration-banner code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
    word-break: break-all;
  }

  .banner-actions {
    margin-top: 0.75em;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }

  .modal-dialog {
    background: var(--background-primary);
    color: var(--text-normal);
    padding: 1.5em;
    border-radius: 8px;
    max-width: 520px;
    width: calc(100% - 2em);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    font-size: 0.95em;
  }

  .modal-dialog h3 {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  .modal-dialog ol {
    margin-left: 1.2em;
    padding-left: 0;
  }

  .modal-dialog code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
    word-break: break-all;
  }

  .modal-actions {
    display: flex;
    gap: 0.5em;
    justify-content: flex-end;
    margin-top: 1em;
  }

  .modal-actions button.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }
</style>
