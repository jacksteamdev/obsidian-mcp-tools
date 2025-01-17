import type { SourceDocuments } from "shared";

export const DEFAULT_SETTINGS: SourceDocuments.Settings = {
  enabled: false,
  templatePath: "",
  sourcesDirectory: "Sources",
  maxPageSize: 5000,
};

export const MINIMUM_PAGE_SIZE = 1000;
