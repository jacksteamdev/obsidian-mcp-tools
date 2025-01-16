import type { Vault } from "obsidian";

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

export async function createFileWithPath(
  vault: Vault,
  path: string,
  data: string,
) {
  const file = vault.getAbstractFileByPath(path);
  if (file) throw new Error(`File already exists: ${path}`);
  await ensureFolder(vault, path);
  return vault.create(path, data);
}
