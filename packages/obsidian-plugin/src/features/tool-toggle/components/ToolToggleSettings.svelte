<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { Notice } from "obsidian";
  import { onMount } from "svelte";
  import { updateClaudeConfig } from "../../mcp-server-install/services/config";
  import { getInstallationStatus } from "../../mcp-server-install/services/status";
  import {
    KNOWN_MCP_TOOL_NAMES,
    parseDisabledToolsCsv,
    serializeDisabledToolsToEnv,
  } from "../utils";

  export let plugin: McpToolsPlugin;

  // Raw textarea contents — always mirrors what the user sees typed.
  // We normalize only on save (not on every keystroke) so typing
  // whitespace or trailing commas feels natural.
  let disabledRaw = "";
  let saving = false;

  onMount(async () => {
    const data = await plugin.loadData();
    const existing = data?.toolToggle?.disabled ?? [];
    disabledRaw = existing.join(", ");
  });

  async function handleSave() {
    saving = true;
    try {
      const disabled = parseDisabledToolsCsv(disabledRaw);

      // Persist to plugin settings first. This is the source of truth
      // and must succeed even if the client config rewrite below fails.
      // When the user clears the list, remove the whole toolToggle key
      // rather than leaving an empty `{ disabled: [] }` behind — keeps
      // data.json tidy and round-trips to "no key" on the next load.
      const data = (await plugin.loadData()) ?? {};
      if (disabled.length === 0) {
        delete data.toolToggle;
      } else {
        data.toolToggle = { disabled };
      }
      await plugin.saveData(data);

      // If the server is already installed, immediately re-write the
      // MCP client's config file so the new disabled list takes effect
      // at the next client restart. If the server is not installed,
      // the disabled list will be applied on the install flow instead.
      const status = await getInstallationStatus(plugin);
      if (status.state === "installed" && status.path) {
        const apiKey = await plugin.getLocalRestApiKey();
        if (!apiKey) {
          throw new Error(
            "Local REST API key not found — cannot update the MCP client config.",
          );
        }
        const envOverrides: Record<string, string> = {};
        const serialized = serializeDisabledToolsToEnv(disabled);
        if (serialized) envOverrides.OBSIDIAN_DISABLED_TOOLS = serialized;
        await updateClaudeConfig(
          plugin,
          status.path,
          apiKey,
          envOverrides,
        );
      }

      new Notice("Disabled MCP tools saved.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save disabled tools";
      new Notice(message);
    } finally {
      saving = false;
    }
  }
</script>

<div class="tool-toggle-settings">
  <h3>Disabled MCP tools</h3>
  <p class="description">
    Comma-separated list of tool names that should be hidden from your
    MCP client. Typos are logged as warnings by the server and do not
    break startup. Changes apply the next time your MCP client
    restarts.
  </p>

  <textarea
    bind:value={disabledRaw}
    placeholder="patch_vault_file, delete_vault_file"
    rows="3"
    disabled={saving}
    aria-label="Disabled MCP tools (comma-separated)"
  ></textarea>

  <div class="actions">
    <button on:click={handleSave} disabled={saving}>
      {saving ? "Saving..." : "Save"}
    </button>
  </div>

  <details>
    <summary>
      Show available tool names ({KNOWN_MCP_TOOL_NAMES.length})
    </summary>
    <ul>
      {#each KNOWN_MCP_TOOL_NAMES as name (name)}
        <li><code>{name}</code></li>
      {/each}
    </ul>
  </details>
</div>

<style>
  .tool-toggle-settings {
    margin-top: 2em;
  }

  .description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-bottom: 0.5em;
  }

  textarea {
    width: 100%;
    font-family: var(--font-monospace);
    font-size: 0.9em;
    resize: vertical;
  }

  .actions {
    margin-top: 0.5em;
    margin-bottom: 1em;
  }

  details summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.9em;
  }

  details ul {
    columns: 2;
    margin-top: 0.5em;
    padding-left: 1.5em;
  }

  details code {
    font-size: 0.85em;
  }
</style>
