import { FuzzySuggestModal, TFile, App } from "obsidian";

export class FileSelectionModal extends FuzzySuggestModal<TFile> {
  constructor(
    app: App,
    private files: TFile[],
    private onSelect: (file: TFile | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Select template file");
  }

  getItems(): TFile[] {
    return this.files;
  }

  getItemText(file: TFile): string {
    return file.path;
  }

  onChooseItem(file: TFile): void {
    this.onSelect(file);
  }

  onClose(): void {
    this.onSelect(null);
  }
}
