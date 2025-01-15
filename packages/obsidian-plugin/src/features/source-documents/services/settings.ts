import type { McpToolsPlugin } from "$/features/core";
import { FileSelectionModal } from "$/shared/components/FileSelectionModal";
import { FolderSelectionModal } from "$/shared/components/FolderSelectionModal";
import { type } from "arktype";
import { App, Notice, TFile, TFolder } from "obsidian";
import { Templater } from "shared";
import { DEFAULT_SETTINGS } from "../constants";
import {
  sourceDocumentSettingsSchema,
  type SourceDocumentSettings,
} from "../types";

export class SettingsManager {
  constructor(
    private plugin: McpToolsPlugin,
    private settings: SourceDocumentSettings = DEFAULT_SETTINGS,
  ) {}

  async loadSettings(): Promise<SourceDocumentSettings> {
    const loaded = await this.plugin.loadData();
    const sourceSettings = loaded?.sourceDocument;

    if (!sourceSettings) {
      return DEFAULT_SETTINGS;
    }

    const result = sourceDocumentSettingsSchema(sourceSettings);

    if (result instanceof type.errors) {
      new Notice("Invalid source document settings, using defaults");
      console.error("Settings validation failed:", result.summary);
      return DEFAULT_SETTINGS;
    }

    return { ...DEFAULT_SETTINGS, ...result };
  }

  async saveSettings(settings: SourceDocumentSettings): Promise<boolean> {
    const result = sourceDocumentSettingsSchema(settings);

    if (result instanceof type.errors) {
      new Notice("Invalid settings, changes not saved");
      console.error("Settings validation failed:", result.summary);
      return false;
    }

    const data = (await this.plugin.loadData()) || {};
    await this.plugin.saveData({
      ...data,
      sourceDocument: settings,
    });
    this.settings = settings;
    return true;
  }

  getSettings(): SourceDocumentSettings {
    return this.settings;
  }

  getTemplaterPlugin(): Templater.ITemplater | undefined {
    return this.plugin.app.plugins.plugins["templater-obsidian"]?.templater;
  }

  async selectTemplate(): Promise<string | null> {
    return new Promise((resolve) => {
      const files = this.plugin.app.vault
        .getFiles()
        .filter((file) => file.path.endsWith(".md"));

      const modal = new FileSelectionModal(this.plugin.app, files, (file) =>
        resolve(file?.path ?? null),
      );
      modal.open();
    });
  }

  async selectDirectory(): Promise<string | null> {
    return new Promise((resolve) => {
      const folders = this.plugin.app.vault.getAllFolders();

      const modal = new FolderSelectionModal(
        this.plugin.app,
        folders,
        (folder) => resolve(folder?.path ?? null),
      );
      modal.open();
    });
  }

  async ensureSourcesDirectory(): Promise<void> {
    const path = this.settings.sourcesDirectory;
    if (!path) return;

    try {
      const folder = this.plugin.app.vault.getAbstractFileByPath(path);
      if (!folder) {
        await this.plugin.app.vault.createFolder(path);
      } else if (!(folder instanceof TFolder)) {
        throw new Error(`${path} exists but is not a folder`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      new Notice(`Failed to create sources directory: ${message}`);
      console.error("Failed to create sources directory:", error);
    }
  }

  /**
   * Get metadata from a file's frontmatter
   */
  static async getMetadata(
    app: App,
    path: string,
  ): Promise<Record<string, unknown>> {
    const file = app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return {};
    }

    const cache = app.metadataCache.getFileCache(file);
    return cache?.frontmatter || {};
  }
}
