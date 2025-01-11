import type { SourceDocumentSettings } from "./types";

export const DEFAULT_SETTINGS: SourceDocumentSettings = {
  enabled: false,
  templatePath: "",
  sourcesDirectory: "Sources",
  maxPageSize: 5000,
};

export const MINIMUM_PAGE_SIZE = 1000;
