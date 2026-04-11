// Side-effect import — applies the McpToolsPluginSettings module
// augmentation so `plugin.loadData()` is typed with `commandPermissions`.
import "./types";

export { default as FeatureSettings } from "./components/CommandPermissionsSettings.svelte";
export {
  CommandPermissionModal,
  type CommandPermissionModalOptions,
  type ModalDecision,
} from "./services/commandPermissionModal";
export { handleCommandPermissionRequest } from "./services/permissionCheck";
export { createMutex, type Mutex } from "./services/settingsLock";
export type { CommandAuditEntry } from "./types";
export {
  AUDIT_LOG_MAX_ENTRIES,
  appendAuditEntry,
  createRuntimeRateCounter,
  decidePermission,
  formatAllowlist,
  isDestructiveCommand,
  parseAllowlistCsv,
  SOFT_RATE_LIMIT_PER_MINUTE,
} from "./utils";
