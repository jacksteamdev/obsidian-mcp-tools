import { describe, expect, test } from "bun:test";
import {
  filterPresetAgainstRegistry,
  mergeIntoAllowlist,
  PRESETS,
  type PresetCategory,
} from "./presets";

function makeRegistry(
  ids: readonly string[],
): Record<string, { id: string; name: string }> {
  return Object.fromEntries(ids.map((id) => [id, { id, name: id }]));
}

describe("PRESETS catalog", () => {
  test("has the three categories called out in the design doc", () => {
    const ids = PRESETS.map((p) => p.id);
    expect(ids).toContain("editing");
    expect(ids).toContain("navigation");
    expect(ids).toContain("search");
  });

  test("no preset is empty", () => {
    for (const preset of PRESETS) {
      expect(preset.commandIds.length).toBeGreaterThan(0);
    }
  });

  test("no preset contains duplicate ids within itself", () => {
    for (const preset of PRESETS) {
      const unique = new Set(preset.commandIds);
      expect(unique.size).toBe(preset.commandIds.length);
    }
  });

  test("every preset id looks like an Obsidian command id (contains ':')", () => {
    // Sanity guard against accidental plain-string entries. Every
    // real Obsidian command is namespaced: `editor:...`, `app:...`,
    // `workspace:...`, `graph:open`, etc.
    for (const preset of PRESETS) {
      for (const cmd of preset.commandIds) {
        expect(cmd).toContain(":");
      }
    }
  });

  test("no preset contains a command matching the destructive heuristic", () => {
    // The whole point of presets is pre-authorization with one click,
    // so they must be curated to exclude anything the modal would
    // flag as destructive. Keep this in sync with the regex in
    // utils.ts::isDestructiveCommand.
    const destructive = /\b(delete|remove|uninstall|trash|clean(?:up)?|purge|drop|reset|clear|wipe)\b/i;
    for (const preset of PRESETS) {
      for (const cmd of preset.commandIds) {
        expect(destructive.test(cmd)).toBe(false);
      }
    }
  });
});

describe("filterPresetAgainstRegistry", () => {
  const preset: PresetCategory = {
    id: "test",
    label: "Test",
    description: "",
    commandIds: ["editor:toggle-bold", "editor:toggle-italic", "graph:open"],
  };

  test("returns ids that exist in the registry, preserving order", () => {
    const registry = makeRegistry([
      "graph:open",
      "editor:toggle-italic",
      "editor:toggle-bold",
      "other:unrelated",
    ]);
    expect(filterPresetAgainstRegistry(preset, registry)).toEqual([
      // Output order follows the preset declaration, not the registry.
      "editor:toggle-bold",
      "editor:toggle-italic",
      "graph:open",
    ]);
  });

  test("drops ids the registry does not expose", () => {
    const registry = makeRegistry(["editor:toggle-bold"]);
    expect(filterPresetAgainstRegistry(preset, registry)).toEqual([
      "editor:toggle-bold",
    ]);
  });

  test("returns an empty array when the registry is undefined", () => {
    // Defensive: if the caller cannot resolve the registry, the
    // preset should apply to nothing rather than persist ghost ids.
    expect(filterPresetAgainstRegistry(preset, undefined)).toEqual([]);
  });

  test("deduplicates if the preset accidentally contains duplicates", () => {
    const dupPreset: PresetCategory = {
      id: "dup",
      label: "Dup",
      description: "",
      commandIds: [
        "editor:toggle-bold",
        "editor:toggle-bold",
        "graph:open",
      ],
    };
    const registry = makeRegistry(["editor:toggle-bold", "graph:open"]);
    expect(filterPresetAgainstRegistry(dupPreset, registry)).toEqual([
      "editor:toggle-bold",
      "graph:open",
    ]);
  });
});

describe("mergeIntoAllowlist", () => {
  test("appends new ids that are not already in the allowlist", () => {
    expect(
      mergeIntoAllowlist(["editor:toggle-bold"], ["graph:open", "app:go-back"]),
    ).toEqual(["editor:toggle-bold", "graph:open", "app:go-back"]);
  });

  test("preserves existing order and skips duplicates", () => {
    // Regression guard: a preset that overlaps with the user's
    // existing allowlist must not re-append the overlap.
    expect(
      mergeIntoAllowlist(
        ["editor:toggle-bold", "graph:open"],
        ["graph:open", "editor:toggle-italic", "editor:toggle-bold"],
      ),
    ).toEqual([
      "editor:toggle-bold",
      "graph:open",
      "editor:toggle-italic",
    ]);
  });

  test("is a no-op when every new id is already present", () => {
    const existing = ["editor:toggle-bold", "graph:open"];
    expect(mergeIntoAllowlist(existing, ["graph:open"])).toEqual(existing);
  });

  test("accepts an empty existing list", () => {
    expect(mergeIntoAllowlist([], ["editor:toggle-bold"])).toEqual([
      "editor:toggle-bold",
    ]);
  });

  test("returns a new array — does not mutate the inputs", () => {
    const existing = ["editor:toggle-bold"];
    const incoming = ["graph:open"];
    const merged = mergeIntoAllowlist(existing, incoming);
    expect(existing).toEqual(["editor:toggle-bold"]);
    expect(incoming).toEqual(["graph:open"]);
    expect(merged).not.toBe(existing);
  });
});
