// Side-effect import — applies the McpToolsPluginSettings module
// augmentation so `plugin.loadData()` is typed with `toolToggle`.
import "./types";

export { default as FeatureSettings } from "./components/ToolToggleSettings.svelte";
export {
  KNOWN_MCP_TOOL_NAMES,
  parseDisabledToolsCsv,
  serializeDisabledToolsToEnv,
} from "./utils";
