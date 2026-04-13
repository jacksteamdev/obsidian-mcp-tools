import type { LocalRestAPI } from "shared";

type ApiPatchArgs = typeof LocalRestAPI.ApiPatchParameters.infer;

const DEFAULT_DELIMITER = "::";

/**
 * URL-encode each segment of a heading target path individually,
 * preserving the delimiter between segments. Non-heading targets
 * (block refs, frontmatter fields) are encoded as a single value.
 */
function encodeTarget(target: string, delimiter?: string): string {
  const delim = delimiter ?? DEFAULT_DELIMITER;
  return target
    .split(delim)
    .map((segment) => encodeURIComponent(segment))
    .join(delim);
}

export function buildPatchHeaders(args: ApiPatchArgs): Record<string, string> {
  const headers: Record<string, string> = {
    Operation: args.operation,
    "Target-Type": args.targetType,
    Target: encodeTarget(args.target, args.targetDelimiter),
  };

  if (args.createTargetIfMissing !== undefined) {
    headers["Create-Target-If-Missing"] = String(args.createTargetIfMissing);
  }
  if (args.targetDelimiter) {
    headers["Target-Delimiter"] = args.targetDelimiter;
  }
  if (args.trimTargetWhitespace !== undefined) {
    headers["Trim-Target-Whitespace"] = String(args.trimTargetWhitespace);
  }
  if (args.contentType) {
    headers["Content-Type"] = args.contentType;
  }

  return headers;
}
