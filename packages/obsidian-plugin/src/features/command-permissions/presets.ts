/**
 * Curated allowlist presets for the Command execution bootstrap UX.
 *
 * The goal of presets is to cut the friction of the first-run setup:
 * a new user shouldn't have to click through the command browser
 * twenty times to authorize basic editor shortcuts before their
 * agent can do anything useful.
 *
 * Each preset is a hand-picked list of **non-destructive** Obsidian
 * built-in command ids likely to be useful in its category. The IDs
 * are exact strings, not patterns — matching by prefix (e.g. every
 * `editor:*`) would also scoop up dangerous or rarely-used commands
 * that should never be pre-authorized by default.
 *
 * At apply time the UI filters each preset against the live command
 * registry (`app.commands.commands`): any id in the preset that is
 * not installed in the user's vault is dropped, so the allowlist
 * stays clean of dead entries. See `filterPresetAgainstRegistry`.
 *
 * Categories intentionally mirror the three buckets called out in
 * the Fase 3 design doc: Editing, Navigation, Search. Additional
 * categories can be added here without any UI changes — the settings
 * component iterates `PRESETS`.
 */

export interface PresetCategory {
  /** Stable identifier. Used as a React-style key in the Svelte each. */
  id: string;
  /** Human-facing label shown on the button. */
  label: string;
  /** Short explanation shown next to the label. */
  description: string;
  /** Ordered list of command ids to bulk-add. */
  commandIds: readonly string[];
}

/**
 * The canonical preset catalog. Keep this list tight — every id
 * here gets pre-authorized by a single user click, so the bar for
 * inclusion is "everybody uses this AND it cannot nuke the vault".
 */
export const PRESETS: readonly PresetCategory[] = [
  {
    id: "editing",
    label: "Editing",
    description: "Common text-formatting and list commands",
    commandIds: [
      "editor:toggle-bold",
      "editor:toggle-italic",
      "editor:toggle-strikethrough",
      "editor:toggle-highlight",
      "editor:toggle-code",
      "editor:toggle-inline-math",
      "editor:toggle-blockquote",
      "editor:toggle-bullet-list",
      "editor:toggle-numbered-list",
      "editor:toggle-checklist-status",
      "editor:toggle-comments",
      "editor:insert-link",
      "editor:insert-wikilink",
      "editor:insert-embed",
      "editor:insert-horizontal-rule",
      "editor:insert-callout",
      "editor:insert-tag",
    ],
  },
  {
    id: "navigation",
    label: "Navigation",
    description: "Pane splits, tab navigation, graph view",
    commandIds: [
      "app:go-back",
      "app:go-forward",
      "editor:focus-top",
      "editor:focus-bottom",
      "editor:focus-left",
      "editor:focus-right",
      "workspace:split-vertical",
      "workspace:split-horizontal",
      "workspace:close",
      "workspace:next-tab",
      "workspace:previous-tab",
      "graph:open",
      "graph:open-local",
    ],
  },
  {
    id: "search",
    label: "Search",
    description: "Quick switcher, global search, file reveal",
    commandIds: [
      "global-search:open",
      "switcher:open",
      "file-explorer:reveal-active-file",
    ],
  },
] as const;

/**
 * Intersect a preset's command ids with the live registry so the
 * allowlist only grows to include commands the vault actually
 * exposes. Preserves the preset's declared order; duplicates in the
 * preset list (should not happen by construction, but defensive)
 * are emitted once.
 *
 * The registry can be undefined in test environments where
 * `app.commands` is not wired up; in that case we return an empty
 * array rather than returning the full preset, which would otherwise
 * persist ids that don't exist in the user's vault.
 */
export function filterPresetAgainstRegistry(
  preset: PresetCategory,
  registry: Record<string, { id: string; name: string }> | undefined,
): string[] {
  if (!registry) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of preset.commandIds) {
    if (seen.has(id)) continue;
    if (registry[id]) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * Merge a batch of new ids into an existing allowlist, preserving
 * order and suppressing duplicates. The existing list comes first
 * (so the user's prior typing order is preserved) and new ids are
 * appended only if not already present.
 */
export function mergeIntoAllowlist(
  existing: readonly string[],
  newIds: readonly string[],
): string[] {
  const seen = new Set(existing);
  const merged = [...existing];
  for (const id of newIds) {
    if (!seen.has(id)) {
      seen.add(id);
      merged.push(id);
    }
  }
  return merged;
}
