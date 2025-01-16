import { type } from "arktype";

/**
 * Sanitizes a title for use as a document ID/filename.
 *
 * @param title - The title to sanitize
 * @returns A sanitized version of the title safe for use as a filename
 *
 * @example
 * sanitizeTitle("How to Build a CLI - John Doe | Example.com")
 * // Returns: "How to Build a CLI"
 *
 * sanitizeTitle("深入理解 JavaScript - 编程指南")
 * // Returns: "深入理解 JavaScript"
 *
 * sanitizeTitle("La programación es divertida!")
 * // Returns: "La programación es divertida"
 */
export function sanitizeTitle(title: string): string {
  return (
    title
      // Remove author and website info (typically after " - " or " | ")
      .split(/\s[|-]\s/)[0]
      // Replace invalid filename characters
      .replace(/[<>:"/\\|?*\x00-\x1F]/g, "-")
      // Convert multiple dashes to single
      .replace(/-+/g, "-")
      // Remove leading/trailing dash and whitespace
      .trim()
      .replace(/^-|-$/g, "")
      // Ensure reasonable length
      .slice(0, 100)
  );
}

/**
 * Tests if a string is a valid document ID.
 * - Must be between 1 and 100 characters
 * - Cannot contain invalid filename characters
 *
 * @example
 * documentIdSchema.allows("valid-document-id") // boolean
 */
export const documentIdSchema = type("0<string<=100").and(
  /^[^<>:"\\|?*\x00-\x1F]+$/,
);
