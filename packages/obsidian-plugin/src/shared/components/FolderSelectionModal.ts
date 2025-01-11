import { FuzzySuggestModal, TFolder, App } from "obsidian";

export class FolderSelectionModal extends FuzzySuggestModal<TFolder> {
  constructor(
    app: App,
    private folders: TFolder[],
    private onSelect: (folder: TFolder | null) => void,
  ) {
    super(app);
    this.setPlaceholder("Select directory");
  }

  getItems(): TFolder[] {
    return this.folders;
  }

  getItemText(folder: TFolder): string {
    return folder.path;
  }

  onChooseItem(folder: TFolder): void {
    this.onSelect(folder);
  }

  onClose(): void {
    setTimeout(() => this.onSelect(null), 0);
  }
}
