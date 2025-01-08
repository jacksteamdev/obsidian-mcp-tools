import { readFileSync, writeFileSync } from "fs";
import path from "path";
import os from "os";
import { which } from "bun";

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error("Usage: install.ts <OBSIDIAN_API_KEY>");
    process.exit(1);
  }
  const apiKey = args[0];

  const configPath = path.join(
    os.homedir(),
    "Library/Application Support/Claude/claude_desktop_config.json",
  );

  const config = JSON.parse(readFileSync(configPath, "utf-8"));
  config.mcpServers["advanced-mcp-server"] = {
    command: which("bun"),
    args: [path.resolve(__dirname, "../src/index.ts")],
    env: {
      OBSIDIAN_API_KEY: apiKey,
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
  console.log("Obsidian MCP Server added successfully.");
}

if (import.meta.main) {
  main();
}
