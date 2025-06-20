import { type } from "arktype";

// Schema for a single vault entry in the configuration file
export const VaultConfigEntrySchema = type({
  vaultId: "string>0", // User-defined unique ID, non-empty
  name: "string>0", // User-friendly display name, non-empty
  path: "string?", // Optional filesystem path (for reference)
  localRestApiBaseUrl: "string.url", // Use ArkType's built-in URL validation
  apiKey: "string>0", // API Key for the vault's Local REST API, non-empty
});

// Type inferred from the schema
export type VaultConfigEntry = typeof VaultConfigEntrySchema.infer;

// Schema for the configuration file structure
export const ConfigFileSchema = type({
  vaults: type(VaultConfigEntrySchema).array(),
  defaultVaultId: "string?", // Optional default vault ID
});

// Type inferred for the config file structure
export type ConfigFile = typeof ConfigFileSchema.infer;

// For backward compatibility, we'll keep VaultsConfigSchema as an array
// but in the future, we should migrate to using ConfigFileSchema
export const VaultsConfigSchema = type(VaultConfigEntrySchema).array();

// Type inferred for the whole config
export type VaultsConfig = typeof VaultsConfigSchema.infer;
