<script lang="ts">
  import { Settings as McpServerInstallSettings } from "src/features/mcp-server-install";
  import { Settings as SourceDocumentSettings } from "$/features/source-documents";
  import type McpServerPlugin from "src/main";

  export let plugin: McpServerPlugin;
</script>

<div class="settings-container">
  <McpServerInstallSettings {plugin} />
  <SourceDocumentSettings {plugin} />
</div>
