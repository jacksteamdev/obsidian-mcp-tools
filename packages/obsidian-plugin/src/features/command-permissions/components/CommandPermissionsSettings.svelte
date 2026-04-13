<script lang="ts">
  import type McpToolsPlugin from "$/main";
  import { Notice } from "obsidian";
  import { onMount } from "svelte";
  import type { CommandAuditEntry } from "../types";
  import {
    AUDIT_LOG_MAX_ENTRIES,
    auditLogCsvFilename,
    auditLogToCsv,
    formatAllowlist,
    parseAllowlistCsv,
  } from "../utils";

  export let plugin: McpToolsPlugin;

  // UI state mirrors what the user sees typed. We normalize only on
  // save (not on every keystroke), same convention as ToolToggleSettings.
  let enabled = false;
  let allowlistRaw = "";
  let saving = false;

  // Ring buffer of recent invocations, loaded on mount and after every
  // save so the UI reflects the latest audit state.
  let recentInvocations: CommandAuditEntry[] = [];

  // Live command list scraped from the Obsidian runtime. Populated
  // on mount so the disclosure-triggered "Add" buttons can append the
  // exact command id the agent would need to target.
  //
  // `app.commands.commands` is a Record<string, { id, name, … }>. It
  // is not part of the public Obsidian API types, so we access it via
  // an unknown cast and extract only the fields we need.
  interface CommandDescriptor {
    id: string;
    name: string;
  }
  let availableCommands: CommandDescriptor[] = [];
  let commandFilter = "";

  // Case-insensitive filter over id + name so power users can narrow
  // down the list when looking for a specific command without paging
  // through all ~200 entries.
  $: filteredCommands = (() => {
    const query = commandFilter.trim().toLowerCase();
    if (!query) return availableCommands;
    return availableCommands.filter(
      (c) =>
        c.id.toLowerCase().includes(query) ||
        c.name.toLowerCase().includes(query),
    );
  })();

  onMount(async () => {
    const data = await plugin.loadData();
    const perms = data?.commandPermissions ?? {};
    enabled = perms.enabled ?? false;
    allowlistRaw = formatAllowlist(perms.allowlist ?? []);
    recentInvocations = perms.recentInvocations ?? [];

    // Snapshot the live command registry. We do this once on mount
    // rather than subscribing because the registry is stable for the
    // duration of a settings-tab visit — the user would have to
    // install a plugin mid-session to change it, at which point they
    // can just close and reopen the tab.
    const registry = (
      plugin.app as unknown as {
        commands?: { commands?: Record<string, CommandDescriptor> };
      }
    ).commands?.commands;
    if (registry) {
      availableCommands = Object.values(registry)
        .map((c) => ({ id: c.id, name: c.name }))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
  });

  async function handleSave() {
    saving = true;
    try {
      const allowlist = parseAllowlistCsv(allowlistRaw);

      const data = (await plugin.loadData()) ?? {};
      // Preserve the existing audit ring buffer — the handler owns
      // writes to it, and the UI must not clobber invocations that
      // landed between mount and save.
      const previous = data.commandPermissions ?? {};
      data.commandPermissions = {
        ...previous,
        enabled,
        allowlist,
      };
      await plugin.saveData(data);

      // Refresh the local copy of the ring buffer so the list of
      // recent invocations under the allowlist reflects anything that
      // landed during the session.
      recentInvocations = data.commandPermissions.recentInvocations ?? [];

      new Notice("Command permissions saved.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to save command permissions";
      new Notice(message);
    } finally {
      saving = false;
    }
  }

  // Append a command id to the textarea without persisting — the user
  // still has to click Save. We dedupe against the current textarea
  // contents so clicking "Add" twice for the same command does not
  // produce a duplicate line.
  function addCommandToAllowlist(commandId: string) {
    const current = parseAllowlistCsv(allowlistRaw);
    if (current.includes(commandId)) {
      new Notice(`'${commandId}' is already in the allowlist.`);
      return;
    }
    const next = [...current, commandId];
    allowlistRaw = formatAllowlist(next);
  }

  // Human-readable timestamp for the audit log. Uses the user's
  // locale so it matches Obsidian's other UI elements; falls back
  // to the raw ISO string on parse failure.
  function formatTimestamp(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString();
  }

  // Trigger a browser download of the audit log as CSV. Runs inside
  // Electron's renderer (Obsidian is an Electron app), so the DOM
  // Blob + anchor-click pattern is the portable choice — it does not
  // require the user to pick a save location and works offline.
  //
  // The \uFEFF prefix is a UTF-8 BOM. Excel on Windows uses it to
  // detect UTF-8 encoding; without it, non-ASCII characters in the
  // reason column would render as mojibake. LibreOffice / Numbers /
  // plain text editors ignore the BOM.
  function exportAuditCsv(entries: readonly CommandAuditEntry[]): void {
    const csv = auditLogToCsv(entries);
    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = auditLogCsvFilename();
    // Safari requires the anchor to be in the DOM before the synthetic
    // click; other browsers are more lenient but this works everywhere.
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="command-permissions-settings">
  <h3>Command execution</h3>
  <p class="description">
    Let the MCP agent run Obsidian commands (the entries you see in the
    command palette). This feature is <strong>off by default</strong>
    — when enabled, only commands on the allowlist below are
    authorized. Everything else is denied and logged. Changes apply
    immediately; no client restart is required.
  </p>

  <label class="toggle-row">
    <input type="checkbox" bind:checked={enabled} disabled={saving} />
    Enable MCP command execution
  </label>

  <label class="allowlist-label">
    Allowlist
    <span class="hint">
      Comma- or newline-separated list of command ids. Use the browser
      below to find the id of a command you want to authorize.
    </span>
  </label>
  <textarea
    bind:value={allowlistRaw}
    placeholder="editor:toggle-bold, graph:open"
    rows="4"
    disabled={saving}
    aria-label="Allowed command ids (comma-separated)"
  ></textarea>

  <div class="actions">
    <button on:click={handleSave} disabled={saving}>
      {saving ? "Saving..." : "Save"}
    </button>
  </div>

  <details class="command-browser">
    <summary>
      Browse available commands ({availableCommands.length})
    </summary>
    {#if availableCommands.length === 0}
      <p class="empty">
        No commands were found in the Obsidian command registry. Try
        closing and reopening the settings tab.
      </p>
    {:else}
      <input
        type="text"
        class="filter"
        placeholder="Filter by id or name..."
        bind:value={commandFilter}
      />
      <ul class="command-list">
        {#each filteredCommands as cmd (cmd.id)}
          <li>
            <div class="cmd-meta">
              <code>{cmd.id}</code>
              <span class="cmd-name">{cmd.name}</span>
            </div>
            <button
              type="button"
              on:click={() => addCommandToAllowlist(cmd.id)}
              disabled={saving}
            >
              Add
            </button>
          </li>
        {/each}
      </ul>
      {#if filteredCommands.length === 0}
        <p class="empty">No commands match your filter.</p>
      {/if}
    {/if}
  </details>

  <details class="audit-log">
    <summary>
      Recent invocations ({recentInvocations.length} / {AUDIT_LOG_MAX_ENTRIES})
    </summary>
    {#if recentInvocations.length === 0}
      <p class="empty">
        No commands have been requested yet. When the agent calls
        <code>execute_obsidian_command</code>, each decision will be
        logged here.
      </p>
    {:else}
      <div class="audit-actions">
        <button
          type="button"
          on:click={() => exportAuditCsv(recentInvocations)}
        >
          Export CSV
        </button>
      </div>
      <ul class="audit-list">
        {#each [...recentInvocations].reverse() as entry, i (entry.timestamp + ":" + i)}
          <li class="audit-entry audit-{entry.decision}">
            <div class="audit-header">
              <code>{entry.commandId}</code>
              <span class="audit-decision">{entry.decision}</span>
              <span class="audit-time">{formatTimestamp(entry.timestamp)}</span>
            </div>
            {#if entry.reason}
              <div class="audit-reason">{entry.reason}</div>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </details>
</div>

<style>
  .command-permissions-settings {
    margin-top: 2em;
  }

  .description {
    color: var(--text-muted);
    font-size: 0.9em;
    margin-bottom: 0.75em;
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 0.5em;
    margin-bottom: 1em;
    cursor: pointer;
  }

  .allowlist-label {
    display: flex;
    flex-direction: column;
    gap: 0.25em;
    font-size: 0.9em;
    margin-bottom: 0.3em;
  }

  .allowlist-label .hint {
    color: var(--text-muted);
    font-size: 0.85em;
    font-weight: normal;
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

  details {
    margin-top: 0.75em;
  }

  details summary {
    cursor: pointer;
    color: var(--text-muted);
    font-size: 0.9em;
  }

  .command-browser .filter {
    width: 100%;
    margin-top: 0.5em;
    margin-bottom: 0.5em;
    font-family: var(--font-monospace);
    font-size: 0.85em;
  }

  .command-list {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 280px;
    overflow-y: auto;
    border: 1px solid var(--background-modifier-border);
    border-radius: 4px;
  }

  .command-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5em;
    padding: 0.3em 0.5em;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .command-list li:last-child {
    border-bottom: none;
  }

  .cmd-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .cmd-meta code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
    word-break: break-all;
  }

  .cmd-name {
    color: var(--text-muted);
    font-size: 0.8em;
  }

  .command-list button {
    flex-shrink: 0;
  }

  .empty {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-top: 0.5em;
  }

  .audit-actions {
    display: flex;
    justify-content: flex-end;
    margin: 0.5em 0 0.25em 0;
  }

  .audit-list {
    list-style: none;
    margin: 0.5em 0 0 0;
    padding: 0;
    max-height: 320px;
    overflow-y: auto;
  }

  .audit-entry {
    padding: 0.4em 0.6em;
    margin-bottom: 0.3em;
    border-left: 3px solid var(--background-modifier-border);
    background: var(--background-secondary);
    border-radius: 3px;
    font-size: 0.85em;
  }

  .audit-allow {
    border-left-color: var(--text-success, #2a7d2a);
  }

  .audit-deny {
    border-left-color: var(--text-error, #c04848);
  }

  .audit-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.5em;
  }

  .audit-header code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
    word-break: break-all;
  }

  .audit-decision {
    text-transform: uppercase;
    font-size: 0.75em;
    font-weight: bold;
    color: var(--text-muted);
  }

  .audit-time {
    color: var(--text-muted);
    font-size: 0.75em;
    margin-left: auto;
  }

  .audit-reason {
    margin-top: 0.25em;
    color: var(--text-muted);
    font-size: 0.8em;
  }
</style>
