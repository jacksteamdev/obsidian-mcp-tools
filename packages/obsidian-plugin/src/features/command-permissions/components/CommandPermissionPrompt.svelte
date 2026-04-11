<script lang="ts">
  // Svelte 5 component. Rendered inside an Obsidian Modal at runtime
  // (see services/commandPermissionModal.ts), but kept as a pure
  // presentational component so the decision flow can be reasoned
  // about without knowing anything about the HTTP handler or the
  // Modal class.
  //
  // The three buttons correspond 1:1 to the persistence semantics:
  //
  //   deny          → never executes, no state change
  //   allow-once    → executes this call only, no state change
  //   allow-always  → executes this call AND appends commandId to the
  //                   persistent allowlist (handler's responsibility)
  //
  // The parent (permissionCheck.ts) decides what to do with each
  // decision; this component just reports what the user clicked.

  export type Decision = "allow-once" | "allow-always" | "deny";

  interface Props {
    commandId: string;
    commandName?: string;
    isDestructive: boolean;
    showRateWarning: boolean;
    rateCount: number;
    onDecision: (decision: Decision) => void;
  }

  let {
    commandId,
    commandName,
    isDestructive,
    showRateWarning,
    rateCount,
    onDecision,
  }: Props = $props();
</script>

<div class="permission-prompt" class:destructive={isDestructive}>
  <h2>Run Obsidian command?</h2>

  <p class="intro">
    The MCP agent is requesting permission to execute an Obsidian
    command on your behalf.
  </p>

  <div class="command-info">
    <code class="cmd-id">{commandId}</code>
    {#if commandName}
      <div class="cmd-name">{commandName}</div>
    {/if}
  </div>

  {#if isDestructive}
    <div class="warning destructive-warning">
      ⚠️ <strong>This command may be destructive.</strong> Its id or
      human name contains a word that often indicates data deletion,
      reset, or cleanup. <em>Allow always</em> is disabled for
      commands like this — if you trust it, use <em>Allow once</em>
      and inspect the result before granting persistent access.
    </div>
  {/if}

  {#if showRateWarning}
    <div class="warning rate-warning">
      ⚠️ The agent has requested <strong>{rateCount}</strong> command
      executions in the last minute. This may indicate a runaway loop
      or an unintended batch — pause and verify that this call is
      expected before continuing.
    </div>
  {/if}

  <div class="hint">
    <strong>Allow once</strong>: run this invocation only; the command
    is not added to your allowlist.
    <strong>Allow always</strong>: run this invocation and add
    <code>{commandId}</code> to your allowlist so future calls skip
    this prompt.
    <strong>Deny</strong>: reject this call; the agent receives a
    permission-denied error.
  </div>

  <div class="buttons">
    <button
      type="button"
      class="cmd-perm-btn cmd-perm-deny"
      onclick={() => onDecision("deny")}
    >
      Deny
    </button>
    <button
      type="button"
      class="cmd-perm-btn cmd-perm-once"
      onclick={() => onDecision("allow-once")}
    >
      Allow once
    </button>
    <button
      type="button"
      class="cmd-perm-btn cmd-perm-always mod-cta"
      onclick={() => onDecision("allow-always")}
      disabled={isDestructive}
      title={isDestructive
        ? "Disabled for potentially destructive commands — use Allow once if you are sure"
        : undefined}
    >
      Allow always
    </button>
  </div>
</div>

<style>
  .permission-prompt {
    max-width: 560px;
  }

  .permission-prompt h2 {
    margin-top: 0;
    margin-bottom: 0.5em;
  }

  .permission-prompt.destructive h2 {
    color: var(--text-error, #c04848);
  }

  .intro {
    color: var(--text-muted);
    margin-bottom: 0.75em;
  }

  .command-info {
    padding: 0.6em 0.8em;
    background: var(--background-secondary);
    border-radius: 4px;
    margin-bottom: 0.75em;
  }

  .cmd-id {
    font-family: var(--font-monospace);
    font-size: 0.95em;
    word-break: break-all;
  }

  .cmd-name {
    color: var(--text-muted);
    font-size: 0.85em;
    margin-top: 0.3em;
  }

  .warning {
    padding: 0.6em 0.8em;
    border-left: 3px solid var(--text-warning, #e1a800);
    background: var(--background-secondary);
    border-radius: 4px;
    font-size: 0.88em;
    margin-bottom: 0.75em;
  }

  .destructive-warning {
    border-left-color: var(--text-error, #c04848);
  }

  .hint {
    color: var(--text-muted);
    font-size: 0.83em;
    margin-bottom: 1em;
    line-height: 1.45;
  }

  .hint code {
    font-family: var(--font-monospace);
    font-size: 0.85em;
  }

  .buttons {
    display: flex;
    gap: 0.5em;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .cmd-perm-btn {
    min-width: 110px;
  }

  .cmd-perm-btn.mod-cta {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
  }

  .cmd-perm-btn.mod-cta:disabled {
    background: var(--background-modifier-border);
    color: var(--text-muted);
    cursor: not-allowed;
  }
</style>
