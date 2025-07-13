import type { App } from "obsidian";
import { getAPI, LocalRestApiPublicApi } from "obsidian-local-rest-api";
import {
  distinct,
  interval,
  map,
  merge,
  scan,
  startWith,
  takeUntil,
  takeWhile,
  timer,
} from "rxjs";
import type { SmartConnections, Templater } from "shared";
import type McpToolsPlugin from "src/main";

export interface Dependency<ID extends keyof App["plugins"]["plugins"], API> {
  id: keyof Dependencies;
  name: string;
  required: boolean;
  installed: boolean;
  url?: string;
  api?: API;
  plugin?: App["plugins"]["plugins"][ID];
}

export interface Dependencies {
  "obsidian-local-rest-api": Dependency<
    "obsidian-local-rest-api",
    LocalRestApiPublicApi
  >;
  "smart-connections": Dependency<
    "smart-connections",
    SmartConnections.SmartSearch
  >;
  "templater-obsidian": Dependency<"templater-obsidian", Templater.ITemplater>;
}

// Smart Connections v3.0+ uses a Smart Environment architecture instead of window.SmartSearch
declare const window: {
  SmartSearch?: SmartConnections.SmartSearch;
} & Window;

export const loadSmartSearchAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependencies["smart-connections"] => {
      const smartConnectionsPlugin = plugin.app.plugins.plugins["smart-connections"] as any;
      
      // Check for Smart Connections v3.0+ (uses smart environment)
      if (smartConnectionsPlugin?.env?.smart_sources) {
        const smartEnv = smartConnectionsPlugin.env;
        
        // Create a compatibility wrapper that matches the old SmartSearch interface
        const api: SmartConnections.SmartSearch = {
          search: async (search_text: string, filter?: any) => {
            try {
              // Use the new v3.0 lookup API
              const results = await smartEnv.smart_sources.lookup({
                hypotheticals: [search_text],
                filter: {
                  limit: filter?.limit,
                  key_starts_with_any: filter?.key_starts_with_any,
                  exclude_key_starts_with_any: filter?.exclude_key_starts_with_any,
                  exclude_key: filter?.exclude_key,
                  exclude_keys: filter?.exclude_keys,
                  exclude_key_starts_with: filter?.exclude_key_starts_with,
                  exclude_key_includes: filter?.exclude_key_includes,
                  key_ends_with: filter?.key_ends_with,
                  key_starts_with: filter?.key_starts_with,
                  key_includes: filter?.key_includes,
                },
              });
              
              // Transform results to match expected format
              return results.map((result: any) => ({
                item: {
                  path: result.item.path,
                  name: result.item.name || result.item.key?.split('/').pop() || result.item.key,
                  breadcrumbs: result.item.breadcrumbs || result.item.path,
                  read: () => result.item.read(),
                  key: result.item.key,
                  file_path: result.item.path,
                  link: result.item.link,
                  size: result.item.size,
                },
                score: result.score,
              }));
            } catch (error) {
              console.error('Smart Connections v3.0 search error:', error);
              return [];
            }
          },
        };
        
        return {
          id: "smart-connections",
          name: "Smart Connections",
          required: false,
          installed: true,
          api,
          plugin: smartConnectionsPlugin,
        };
      }
      
      // Try window.SmartSearch first (works on some platforms for v2.x)
      let legacyApi = window.SmartSearch;
      
      // Fallback to plugin system (fixes Linux/cross-platform detection issues)
      if (!legacyApi && smartConnectionsPlugin?.env) {
        legacyApi = smartConnectionsPlugin.env;
        // Cache it for future use
        window.SmartSearch = legacyApi;
      }
      
      return {
        id: "smart-connections",
        name: "Smart Connections",
        required: false,
        installed: !!legacyApi,
        api: legacyApi,
        plugin: smartConnectionsPlugin,
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadLocalRestAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependencies["obsidian-local-rest-api"] => {
      const api = getAPI(plugin.app, plugin.manifest);
      return {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: !!api,
        api,
        plugin: plugin.app.plugins.plugins["obsidian-local-rest-api"],
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadTemplaterAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependencies["templater-obsidian"] => {
      const api = plugin.app.plugins.plugins["templater-obsidian"]?.templater;
      return {
        id: "templater-obsidian",
        name: "Templater",
        required: false,
        installed: !!api,
        api,
        plugin: plugin.app.plugins.plugins["templater-obsidian"],
      };
    }),
    takeWhile((dependency) => !dependency.installed, true),
    distinct(({ installed }) => installed),
  );

export const loadDependencies = (plugin: McpToolsPlugin) => {
  const dependencies: Dependencies = {
    "obsidian-local-rest-api": {
      id: "obsidian-local-rest-api",
      name: "Local REST API",
      required: true,
      installed: false,
      url: "https://github.com/coddingtonbear/obsidian-local-rest-api",
    },
    "smart-connections": {
      id: "smart-connections",
      name: "Smart Connections",
      required: false,
      installed: false,
      url: "https://smartconnections.app/",
    },
    "templater-obsidian": {
      id: "templater-obsidian",
      name: "Templater",
      required: false,
      installed: false,
      url: "https://silentvoid13.github.io/Templater/",
    },
  };
  return merge(
    loadLocalRestAPI(plugin),
    loadTemplaterAPI(plugin),
    loadSmartSearchAPI(plugin),
  ).pipe(
    scan((acc, dependency) => {
      // @ts-expect-error Dynamic key assignment
      acc[dependency.id] = {
        ...dependencies[dependency.id],
        ...dependency,
      };
      return acc;
    }, dependencies),
    startWith(dependencies),
  );
};

export const loadDependenciesArray = (plugin: McpToolsPlugin) =>
  loadDependencies(plugin).pipe(
    map((deps) => Object.values(deps) as Dependencies[keyof Dependencies][]),
  );

export * from "./logger";
