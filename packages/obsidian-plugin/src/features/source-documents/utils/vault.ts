import type { TFile, Vault } from "obsidian";

/**
 * Ensures that the specified folder path exists in the Obsidian vault. If any parent folders in the path do not exist, they will be created automatically.
 *
 * @param vault - The Obsidian vault instance to create the folder in.
 * @param path - The full path of the folder to ensure, including the filename.
 * @returns A Promise that resolves when the folder has been created.
 */
async function ensureFolder(vault: Vault, path: string) {
  const folders = path.split("/").slice(0, -1);
  if (folders.length) {
    const folderPath = folders.join("/");
    const folder = vault.getAbstractFileByPath(folderPath);
    if (!folder) {
      await vault.createFolder(folderPath);
    }
  }
}

/**
 * Creates a new file in the Obsidian vault with the specified path and optional data.
 * If the parent folders in the path do not exist, they will be created automatically.
 *
 * @param vault - The Obsidian vault instance to create the file in.
 * @param path - The full path of the file to create, including the filename.
 * @param data - The optional content to write to the new file.
 * @returns A Promise that resolves to the newly created TFile instance.
 */
export async function createFileWithPath(
  vault: Vault,
  path: string,
  data = "",
): Promise<TFile> {
  await ensureFolder(vault, path);
  return vault.create(path, data);
}
