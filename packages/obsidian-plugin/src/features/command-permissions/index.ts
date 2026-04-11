// Side-effect import — applies the McpToolsPluginSettings module
// augmentation so `plugin.loadData()` is typed with `commandPermissions`.
import "./types";

export { default as FeatureSettings } from "./components/CommandPermissionsSettings.svelte";
export { handleCommandPermissionRequest } from "./services/permissionCheck";
export type { CommandAuditEntry } from "./types";
export {
  AUDIT_LOG_MAX_ENTRIES,
  appendAuditEntry,
  decidePermission,
  formatAllowlist,
  parseAllowlistCsv,
} from "./utils";
