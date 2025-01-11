<script lang="ts">
  interface Props {
    isEnabled: boolean;
    onChange: (newValue: boolean) => void;
  }

  let { isEnabled, onChange }: Props = $props();
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="checkbox-container is-enabled"
  class:is-enabled={isEnabled}
  onclick={() => onChange(!isEnabled)}
>
  <input type="checkbox" bind:checked={isEnabled} />
</div>
