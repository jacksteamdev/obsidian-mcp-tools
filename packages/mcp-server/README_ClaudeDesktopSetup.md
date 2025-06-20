# Setting up Obsidian MCP Tools Server with Claude Desktop

This guide explains how to compile and configure the Obsidian MCP Tools server to work with Claude Desktop.

## 1. Compile the MCP Server

The MCP server is located in the `packages/mcp-server` directory. You will need Bun installed to compile it.

1.  **Navigate to the server directory:**
    ```bash
    cd packages/mcp-server
    ```
2.  **Install dependencies:**
    ```bash
    bun install
    ```
3.  **Compile the server:**
    ```bash
    bun run build
    ```
    This will create an executable file (e.g., `mcp-server`) in the `packages/mcp-server/dist` directory.

## 2. Configure Vaults (`vaults.json`)

The MCP server needs to know which Obsidian vaults it can access. This is configured via a `vaults.json` file.

1.  **Create the `vaults.json` file:**
    This file should be placed in a location accessible by the server. A common practice is to place it in a user's configuration directory or alongside the compiled server executable. For example, on macOS, you might place it in `~/Library/Application Support/obsidian-mcp-tools/vaults.json`.

2.  **Example `vaults.json` content:**
    ```json
    {
      "defaultVaultId": "your-default-vault-id",
      "vaults": [
        {
          "vaultId": "your-first-vault-id",
          "name": "My Main Obsidian Vault",
          "path": "/path/to/your/Obsidian/Vault"
        },
        {
          "vaultId": "your-second-vault-id",
          "name": "My Second Obsidian Vault",
          "path": "/path/to/your/Another/Obsidian/Vault"
        }
      ]
    }
    ```
    *   Replace `"your-default-vault-id"`, `"your-first-vault-id"`, `"your-second-vault-id"` with unique identifiers for your vaults. These IDs are used by Claude Desktop to specify which vault to interact with.
    *   Replace `"My Main Obsidian Vault"` and `"My Second Obsidian Vault"` with human-readable names for your vaults.
    *   Replace `"/path/to/your/Obsidian/Vault"` with the actual absolute path to your Obsidian vault folder on your system.

## 3. Configure Claude Desktop

To connect Claude Desktop to your MCP server, you need to add an entry to its `config.json` file.

1.  **Locate Claude Desktop's `config.json`:**
    The location of this file varies by operating system.
    *   **macOS:** `~/Library/Application Support/Claude/config.json`
    *   **Windows:** `%APPDATA%\Claude\config.json`
    *   **Linux:** `~/.config/Claude/config.json`

2.  **Add the server configuration:**
    Open `config.json` and add an entry under the `mcp` section. If the `mcp` section doesn't exist, create it.

    ```json
    {
      "mcp": {
        "servers": [
          {
            "name": "obsidian-mcp-tools",
            "command": "/path/to/your/compiled/mcp-server/dist/mcp-server",
            "environment": {
              "MCP_VAULTS_CONFIG_PATH": "/path/to/your/vaults.json"
            }
          }
        ]
      }
      // ... other Claude config ...
    }
    ```
    *   Replace `"/path/to/your/compiled/mcp-server/dist/mcp-server"` with the absolute path to the executable you compiled in step 1.
    *   Replace `"/path/to/your/vaults.json"` with the absolute path to the `vaults.json` file you created in step 2. This environment variable tells the MCP server where to find its configuration.

## 4. Start Claude Desktop and Test

After saving the `config.json` file, restart Claude Desktop. The `obsidian-mcp-tools` server should now be available. You can test it by trying to use a tool that lists vaults, for example, if such a tool is exposed by the server.

---
**Reference:** This server is part of the larger [obsidian-mcp-tools](https://github.com/jacksteamdev/obsidian-mcp-tools) project.
