/**
 * Normalizes a directory path by removing trailing slashes.
 * This prevents double slashes when constructing API paths.
 *
 * @param directory - The directory path to normalize (can be undefined)
 * @returns The normalized directory path without trailing slashes, or undefined if input is undefined
 *
 * @example
 * normalizeDirectory("DevOps/") // "DevOps"
 * normalizeDirectory("DevOps") // "DevOps"
 * normalizeDirectory("path/to/dir///") // "path/to/dir"
 * normalizeDirectory(undefined) // undefined
 * normalizeDirectory("") // ""
 */
export function normalizeDirectory(directory?: string): string | undefined {
  if (directory === undefined) {
    return undefined;
  }

  // Remove all trailing slashes
  return directory.replace(/\/+$/, "");
}
