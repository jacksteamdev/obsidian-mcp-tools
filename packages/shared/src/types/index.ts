export * as LocalRestAPI from "./plugin-local-rest-api";
export * as SmartConnections from "./plugin-smart-connections";
export * as Templater from "./plugin-templater";
export * from "./prompts";
export * from "./smart-search";
export * from "./source-document";

export type SetupFunctionResult = Promise<
  { success: true } | { success: false; error: string }
>;
