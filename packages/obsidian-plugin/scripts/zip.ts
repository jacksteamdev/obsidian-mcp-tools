import { create } from "archiver";
import { createWriteStream } from "fs";
import fs from "fs-extra";
import { join, resolve } from "path";
import { version } from "../../../package.json" with { type: "json" };

async function zipPlugin() {
  const pluginDir = resolve(import.meta.dir, "..");       // packages/obsidian-plugin/
  const repoRoot = resolve(import.meta.dir, "../../..");  // repo root — where main.js actually lives

  const releaseDir = join(pluginDir, "releases");
  fs.ensureDirSync(releaseDir);

  const zipFilePath = join(releaseDir, `obsidian-plugin-${version}.zip`);
  const output = createWriteStream(zipFilePath);
  const archive = create("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  archive.file(join(repoRoot, "main.js"), { name: "main.js" });
  archive.file(join(repoRoot, "manifest.json"), { name: "manifest.json" });
  archive.file(join(repoRoot, "styles.css"), { name: "styles.css" });

  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    output.on("error", reject);
    archive.on("error", reject);
    archive.finalize();
  });

  console.log("Plugin files zipped successfully!");
}

zipPlugin().catch(console.error);
