import { $ } from "bun";
import { readFileSync, writeFileSync } from "fs";

// Check for uncommitted changes
const status = await $`git status --porcelain`.quiet();
if (!!status.text() && !process.env.FORCE) {
  console.error(
    "There are uncommitted changes. Commit them before releasing or run with FORCE=true.",
  );
  process.exit(1);
}

// Check if on main branch
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.quiet())
  .text()
  .trim();
if (currentBranch !== "main" && !process.env.FORCE) {
  console.error(
    "Not on main branch. Switch to main before releasing or run with FORCE=true.",
  );
  process.exit(1);
}

// Bump project version. When invoked as `bun run version <part>`,
// Bun's argv is [bunBinary, scriptPath, <part>] — the user-supplied
// semver part lives at index 2, not 3. The previous code used
// argv[3], which was always undefined under the documented call
// convention, so every invocation silently fell back to "patch"
// regardless of what the user typed (caught while preparing the
// 0.3.0 cut: `bun run version minor` produced 0.2.28).
const semverPart = Bun.argv[2] || "patch";
const json = await Bun.file("./package.json").json();
const [major, minor, patch] = json.version.split(".").map((s) => parseInt(s));
json.version = bump([major, minor, patch], semverPart);
await Bun.write("./package.json", JSON.stringify(json, null, 2) + "\n");

// Update manifest.json with new version and get minAppVersion
const pluginManifestPath = "./manifest.json";
const pluginManifest = await Bun.file(pluginManifestPath).json();
const { minAppVersion } = pluginManifest;
pluginManifest.version = json.version;
await Bun.write(
  pluginManifestPath,
  JSON.stringify(pluginManifest, null, 2) + "\n",
);

// Update versions.json with target version and minAppVersion from manifest.json
const pluginVersionsPath = "./versions.json";
let versions = JSON.parse(readFileSync(pluginVersionsPath, "utf8"));
versions[json.version] = minAppVersion;
writeFileSync(pluginVersionsPath, JSON.stringify(versions, null, "\t") + "\n");

// Commit, tag and push
await $`git add package.json ${pluginManifestPath} ${pluginVersionsPath}`;
await $`git commit -m ${json.version}`;
await $`git tag ${json.version}`;
await $`git push`;
await $`git push origin ${json.version}`;

function bump(semver: [number, number, number], semverPart = "patch") {
  switch (semverPart) {
    case "major":
      semver[0]++;
      semver[1] = 0;
      semver[2] = 0;
      break;
    case "minor":
      semver[1]++;
      semver[2] = 0;
      break;
    case "patch":
      semver[2]++;
      break;
    default:
      throw new Error(`Invalid semver part: ${semverPart}`);
  }

  return semver.join(".");
}
