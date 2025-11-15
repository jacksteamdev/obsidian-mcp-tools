import path from "path";

/**
 * Normalizes a file path by removing duplicate consecutive path segments.
 * This fixes issues where paths like "/home/user/home/user/vault" are created.
 *
 * @param filepath - The file path to normalize
 * @returns The normalized file path with duplicate consecutive segments removed
 *
 * @example
 * normalizeDuplicateSegments("/home/user/home/user/vault") // "/home/user/vault"
 * normalizeDuplicateSegments("/home/user/vault") // "/home/user/vault"
 * normalizeDuplicateSegments("/a/b/a/b/c") // "/a/b/c"
 */
export function normalizeDuplicateSegments(filepath: string): string {
  const isAbsolute = path.isAbsolute(filepath);
  const parts = filepath.split(path.sep).filter(p => p !== "");

  // Remove duplicate consecutive segments by looking for patterns
  const normalized: string[] = [];
  let i = 0;

  while (i < parts.length) {
    const currentPart = parts[i];

    // Look ahead to see if we have a repeating pattern
    // For example: /home/user/home/user should become /home/user
    let patternLength = 1;
    let foundPattern = false;

    // Try to find repeating patterns of increasing length
    while (patternLength <= (parts.length - i) / 2) {
      const pattern = parts.slice(i, i + patternLength);
      const next = parts.slice(i + patternLength, i + patternLength * 2);

      if (pattern.length === next.length &&
          pattern.every((p, idx) => p === next[idx])) {
        // Found a repeating pattern, skip the duplicate
        foundPattern = true;
        i += patternLength;
        break;
      }
      patternLength++;
    }

    if (!foundPattern) {
      normalized.push(currentPart);
      i++;
    }
  }

  const result = normalized.join(path.sep);
  return isAbsolute ? path.sep + result : result;
}
