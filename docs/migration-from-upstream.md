# Migrating from `jacksteamdev/obsidian-mcp-tools`

This guide is for users coming from the upstream **MCP Tools** plugin (`mcp-tools` id, by Jack Steam) who want to switch to **MCP Connector** (`mcp-tools-istefox` id, this fork) without losing their settings.

## Why migrate

Upstream `jacksteamdev/obsidian-mcp-tools` has been dormant since July 2025 and the maintainer call closed without a successor. Most of the bugs reported on its issue tracker — including frequently requested ones — are already fixed in this fork. See the [README](../README.md) for the full feature comparison; the short version is that 21 of the 24 currently-open upstream issues are resolved here, plus the full Issue #29 command-execution flow.

The plugin is published under a **different id** (`mcp-tools-istefox` vs upstream's `mcp-tools`) so it can coexist with upstream in Obsidian's community store. Because the id is different, Obsidian treats it as a separate plugin: it gets its own folder, its own `data.json`, and its own enabled-state. That means **upgrading is not automatic** — the steps below walk through the one-time migration.

## Migration steps

### 1. Disable the upstream plugin

In Obsidian: **Settings → Community plugins**, find **"MCP Tools"** by Jack Steam, toggle it off. Don't uninstall yet — keep it around in case you want to roll back during the transition.

### 2. Install MCP Connector

Two options:

- **Community store** (recommended once approved): **Settings → Community plugins → Browse**, search "MCP Connector", click Install + Enable.
- **BRAT** (available immediately if community store review is still in progress): install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat), then add `istefox/obsidian-mcp-connector` as a beta plugin, enable it.

### 3. (Optional) Carry over your settings

If you previously customized the upstream plugin (allowlist, command-permission audit log, disabled-tools list, install-location override), you can preserve those by copying its `data.json` over the fresh one this fork creates:

```bash
# Adjust the path to your vault as needed.
VAULT=~/Obsidian/MyVault

# Backup first — never overwrite without a safety copy.
cp "$VAULT/.obsidian/plugins/mcp-tools-istefox/data.json" \
   "$VAULT/.obsidian/plugins/mcp-tools-istefox/data.json.bak"

# Copy upstream settings on top.
cp "$VAULT/.obsidian/plugins/mcp-tools/data.json" \
   "$VAULT/.obsidian/plugins/mcp-tools-istefox/data.json"
```

If you didn't customize anything, skip this step — the fork uses the same defaults as upstream.

### 4. Re-run "Install server" in MCP Connector settings

**Settings → MCP Connector → Installation status → Install** (or Reinstall if the binary is already on disk from the upstream version). This step:

- Confirms the server binary is present at `~/Library/Application Support/obsidian-mcp-tools/bin/mcp-server` (Linux/macOS) or the equivalent on Windows.
- Rewrites your Claude Desktop config (`claude_desktop_config.json`) with the API key from this vault's Local REST API plugin.

### 5. Restart Claude Desktop (and any other MCP clients)

Quit Claude Desktop completely (`Cmd+Q` on macOS, not just close the window) and reopen it. The new MCP server entry will now point to a binary launched with the correct API key for your vault.

If you use Claude Code, Cline, Zed, Continue, or any other MCP client, repeat their respective restart procedure.

### 6. Verify the connection

Open a new chat in your client and ask the agent to do something simple, e.g. *"List the files in my Obsidian vault"*. If you get a directory listing, the migration is complete.

### 7. (Optional) Uninstall the upstream plugin

Once you've confirmed everything works, you can remove the upstream plugin: **Settings → Community plugins → MCP Tools (Jack Steam) → Uninstall**. The plugin folder, its `data.json`, and any cached state are removed.

## Troubleshooting

- **The agent reports "401 Unauthorized" or "Connection refused"** — Local REST API is either disabled in the active vault or the API key in `claude_desktop_config.json` doesn't match. Re-run step 4.
- **The plugin doesn't appear in the community store** — community-store review takes weeks. Use BRAT (step 2) in the meantime.
- **Lost settings** — restore from the `.bak` you made in step 3, or reconfigure from scratch (the new defaults are documented in the README).

## What stays the same

- The Local REST API plugin (port 27124, API key) — unchanged, keep using the same install.
- Templater and Smart Connections plugins (if used) — unchanged.
- The MCP server binary location — unchanged from upstream's "outside vault" install path. The fork keeps the binary at the same place, so a re-run of "Install server" will pick up the existing binary if present.
- Your prompts in `Prompts/` (if you use the prompt feature) — unchanged.
- Your Claude Desktop config file location — unchanged (`~/Library/Application Support/Claude/claude_desktop_config.json`).
