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

export * from "shared";
export * from "./utils";

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

// The Smart Connections plugin exposes a global variable `window.SmartSearch` but it's not guaranteed to be available.
declare const window: {
  SmartSearch?: SmartConnections.SmartSearch;
} & Window;

export const loadSmartSearchAPI = (plugin: McpToolsPlugin) =>
  interval(200).pipe(
    takeUntil(timer(5000)),
    map((): Dependencies["smart-connections"] => {
      const api = window.SmartSearch;
      return {
        id: "smart-connections",
        name: "Smart Connections",
        required: false,
        installed: !!api,
        api,
        plugin: plugin.app.plugins.plugins["smart-connections"],
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
