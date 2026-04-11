import { environmentVariables } from "./bundle-time" with { type: "macro" };

// Bundle-time macro: must stay in this module (not in ./paths) so the
// macro runs during the plugin build and does not leak into unit tests.
export const { GITHUB_DOWNLOAD_URL, GITHUB_REF_NAME } =
  environmentVariables();

// Re-export the static constants from ./paths so all existing callers
// that do `import { CLAUDE_CONFIG_PATH } from "../constants"` keep working.
export {
  ARCH_TYPES,
  BINARY_NAME,
  CLAUDE_CONFIG_PATH,
  INSTALL_PATH,
  LOG_PATH,
  PLATFORM_TYPES,
  type Arch,
  type Platform,
} from "./paths";
