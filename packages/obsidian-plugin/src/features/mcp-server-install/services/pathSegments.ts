import path from "path";

/**
 * Remove consecutive duplicate sub-sequences from a filesystem path.
 *
 * Motivation: on some macOS configurations (iCloud Drive, symlinked
 * vaults) `fsp.realpath` occasionally emits paths where a segment
 * sequence appears twice — e.g. `/home/user/home/user/vault` or
 * `/Users/me/Library/Mobile Documents/Users/me/Library/Mobile Documents/vault`.
 * These doubled paths break the subsequent filesystem checks in
 * `getInstallationStatus`. This helper walks the path segments and
 * collapses any run that matches the tail of what's already accumulated.
 *
 * Isolated in its own module (with no Obsidian imports) so that the
 * pure logic can be unit-tested via `bun:test` without mocking the
 * Obsidian plugin runtime.
 */
export function removeDuplicatePathSegments(filepath: string): string {
  const parts = filepath.split(path.sep);
  const normalized: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    // Skip empty parts except for the first one (which is the root on POSIX).
    if (part === "" && i !== 0) continue;

    // At each non-first, non-empty segment, check whether the next
    // `len` segments in the input match the last `len` segments we've
    // already accumulated. If so, the sequence is a duplicate and we
    // skip past it.
    if (i > 0 && part !== "") {
      let isDuplicate = false;
      const lookAhead = Math.min(normalized.length, parts.length - i);

      for (let len = 1; len <= lookAhead; len++) {
        const normalizedSlice = normalized.slice(-len);
        const partsSlice = parts.slice(i, i + len);

        if (
          JSON.stringify(normalizedSlice) === JSON.stringify(partsSlice)
        ) {
          i += len - 1; // advance past the duplicate run
          isDuplicate = true;
          break;
        }
      }

      if (isDuplicate) continue;
    }

    normalized.push(part);
  }

  // Degenerate cases: empty or root-only input → return platform root.
  if (normalized.length === 0) return path.sep;
  if (normalized.length === 1 && normalized[0] === "") return path.sep;

  // Preserve leading slash for absolute paths — path.join() strips it.
  const result = path.join(...normalized);
  if (normalized[0] === "" && !result.startsWith(path.sep)) {
    return path.sep + result;
  }
  return result;
}
