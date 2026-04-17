import { zip } from "radash";

/**
 * Formats a template string with the provided values, while preserving the original indentation.
 * This function is used to format error messages or other string templates that need to preserve
 * the original formatting.
 *
 * @param strings - An array of template strings.
 * @param values - The values to be interpolated into the template strings.
 * @returns The formatted string with the values interpolated.
 *
 * @example
 * const f``
 */
export const f = (strings: TemplateStringsArray, ...values: unknown[]) => {
  const stack = { stack: "" };
  Error.captureStackTrace(stack, f);

  // Get the first caller's line from the stack trace
  const stackLine = stack.stack.split("\n")[1] ?? "";

  // Extract column number using regex
  // This matches the column number at the end of the line like: "at filename:line:column"
  const columnMatch = stackLine.match(/:(\d+)$/);
  const columnNumber = columnMatch ? parseInt(columnMatch[1], 10) - 1 : 0;

  return zip(
    strings.map((s) =>
      s.replace(new RegExp(String.raw`\n\s{${columnNumber}}`), "\n"),
    ),
    values,
  )
    .flat()
    .join("")
    .trim();
};
