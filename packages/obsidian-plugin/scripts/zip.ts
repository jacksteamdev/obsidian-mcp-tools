import { create } from "archiver";
import { createWriteStream, existsSync } from "fs";
import fs from "fs-extra";
import { join, resolve } from "path";
import { version } from "../../../package.json" with { type: "json" };

/**
 * Build the user-installable zip for a manual "drop into vault" install
 * (also used by BRAT and community-store side-loading paths).
 *
 * The zip MUST contain main.js + manifest.json at the archive root: an
 * Obsidian plugin folder is unpacked verbatim into
 * `{vault}/.obsidian/plugins/<plugin-id>/`. styles.css is OPTIONAL —
 * Svelte 5's bundler inlines component-scoped CSS into main.js, so this
 * project doesn't currently emit a separate stylesheet. We include it
 * only if a future build does emit one, so the zip stays correct
 * without changes here.
 *
 * Path note: `bun.config.ts` writes its outputs to the REPO ROOT
 * (`outdir: "../.."`) because Obsidian expects main.js next to
 * manifest.json. This script previously looked for them inside
 * `packages/obsidian-plugin/`, producing a silent empty zip — fixed
 * here to read from the actual emit location.
 */
async function zipPlugin() {
  const pluginDir = resolve(import.meta.dir, "..");
  const repoRoot = resolve(pluginDir, "..", "..");

  const releaseDir = join(pluginDir, "releases");
  fs.ensureDirSync(releaseDir);

  const zipFilePath = join(releaseDir, `obsidian-plugin-${version}.zip`);
  const output = createWriteStream(zipFilePath);

  const archive = create("zip", { zlib: { level: 9 } });
  archive.pipe(output);

  // Required files — fail loudly if either is missing instead of
  // producing an empty zip the way the previous version did.
  for (const required of ["main.js", "manifest.json"] as const) {
    const sourcePath = join(repoRoot, required);
    if (!existsSync(sourcePath)) {
      throw new Error(
        `Required plugin artifact missing at ${sourcePath} — did the build run?`,
      );
    }
    archive.file(sourcePath, { name: required });
  }

  // Optional: include styles.css if a build ever emits one.
  const stylesPath = join(repoRoot, "styles.css");
  if (existsSync(stylesPath)) {
    archive.file(stylesPath, { name: "styles.css" });
  }

  await archive.finalize();
  console.log(`Plugin files zipped successfully to ${zipFilePath}`);
}

zipPlugin().catch((err) => {
  console.error(err);
  process.exit(1);
});
