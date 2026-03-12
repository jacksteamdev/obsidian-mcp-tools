import type { LocalRestAPI } from "shared";

type ApiPatchArgs = typeof LocalRestAPI.ApiPatchParameters.infer;

export function buildPatchHeaders(args: ApiPatchArgs): Record<string, string> {
  const headers: Record<string, string> = {
    Operation: args.operation,
    "Target-Type": args.targetType,
    Target: args.target,
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
