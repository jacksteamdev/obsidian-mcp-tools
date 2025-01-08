# MCP Server Installation Feature Requirements

## Overview

This feature enables users to install and manage the MCP server executable through the Obsidian plugin settings interface. The system handles the download of platform-specific binaries, Claude Desktop configuration, and provides clear user feedback throughout the process.

## Implementation Location

The installation feature is implemented in the Obsidian plugin package under `src/features/mcp-server-install`.

## Installation Flow

1. User Prerequisites:

   - Claude Desktop installed
   - Local REST API plugin installed and configured with API key
   - (Optional) Templater plugin for enhanced functionality
   - (Optional) Smart Connections plugin for enhanced search

2. Installation Steps:
   - User navigates to plugin settings
   - Plugin verifies prerequisites and shows status
   - User initiates installation via button
   - Plugin retrieves API key from Local REST API plugin
   - Plugin downloads appropriate binary
   - Plugin updates Claude config file
   - Plugin confirms successful installation

## Settings UI Requirements

The settings UI is implemented as a Svelte component in `components/SettingsTab.svelte`.

1. Component Structure:
   ```svelte
   <script lang="ts">
     // Import Svelte stores for state management
     import { installationStatus } from '../stores/status';
     import { dependencies } from '../stores/dependencies';
     
     // Props from parent Settings.svelte
     export let plugin: Plugin;
   </script>

   <!-- Installation status and controls -->
   <div class="installation-status">
     <!-- Dynamic content based on $installationStatus -->
   </div>

   <!-- Dependencies section -->
   <div class="dependencies">
     <!-- Dynamic content based on $dependencies -->
   </div>

   <!-- Links section -->
   <div class="links">
     <!-- External resource links -->
   </div>
   ```

2. Display Elements:
   - Installation status indicator with version
   - Install/Update/Uninstall buttons
   - Dependency status and links
   - Links to:
     - Downloaded executable location (with folder access)
     - Log folder location (with folder access)
     - GitHub repository
     - Claude Desktop download page (when needed)
     - Required and recommended plugins

3. State Management:
   - Uses Svelte stores for reactive state
   - Status states:
     - Not Installed
     - Installing
     - Installed
     - Update Available

## Download Management

1. Binary Source:

   - GitHub latest release
   - Platform-specific naming conventions
   - Version number included in filename (e.g., mcp-server-1.2.3)

2. Installation Locations:
   - Binary: {vault}/.obsidian/plugins/{plugin-id}/bin/
   - Logs:
      - macOS: ~/Library/Logs/Claude/mcp-server-obsidian-advanced
      - Windows: %APPDATA%\Claude\mcp-server-obsidian-advanced\logs
      - Linux: ~/.local/share/Claude/mcp-server-obsidian-advanced/logs

## Claude Configuration

1. Config File:
   - Location: ~/Library/Application Support/Claude/claude_desktop_config.json
   - Create base structure if missing: { "mcpServers": {} }
   - Add/update only our config entry:
     ```json
     {
       "mcpServers": {
         "obsidian-advanced": {
           "command": "(absolute path to executable)",
           "env": {
             "OBSIDIAN_API_KEY": "(stored api key)"
           }
         }
       }
     }
     ```

## Version Management

1. Unified Version Approach:
   - Plugin and server share same version number
   - Version stored in plugin manifest
   - Server provides version via `--version` flag
   - Version checked during plugin initialization

## User Education

1. Documentation Requirements:
   - README.md must explain:
     - Binary download and installation process
     - GitHub source code location
     - Claude config file modifications
     - Log file locations and purpose
   - Settings page must link to full documentation

## Error Handling

1. Installation Errors:

   - Claude Desktop not installed
   - Download failures
   - Permission issues
   - Version mismatch

2. User Feedback:
   - Use Obsidian Notice API for progress/status
   - Clear error messages with next steps
   - Links to troubleshooting resources

## Uninstall Process

1. Cleanup Actions:
   - Remove executable
   - Remove our entry from Claude config
   - Clear stored plugin data

## Appendix: Implementation Insights

### Feature Organization
The feature follows a modular structure:
```
src/features/mcp-server-install/
├── components/       # Svelte components
│   └── SettingsTab.svelte
├── services/        # Core functionality
│   ├── config.ts    # Claude config management
│   ├── download.ts  # Binary download
│   ├── status.ts    # Installation status
│   └── uninstall.ts # Cleanup operations
├── stores/          # Svelte stores
│   ├── status.ts    # Installation status store
│   └── dependencies.ts # Dependencies status store
├── utils/           # Shared utilities
│   └── openFolder.ts
├── constants.ts     # Configuration
├── types.ts         # Type definitions
└── index.ts         # Feature setup & component export
```

### Key Implementation Decisions

1. API Key Management
   - Removed manual API key input
   - Automatically retrieved from Local REST API plugin
   - Reduces user friction and potential errors

2. Symlink Resolution
   - Added robust symlink handling for binary paths
   - Ensures correct operation even with complex vault setups
   - Handles non-existent paths during resolution

3. Status Management
   - Unified status interface with version tracking
   - Real-time status updates during operations
   - Clear feedback for update availability

4. Error Handling
   - Comprehensive prerequisite validation
   - Detailed error messages with next steps
   - Proper cleanup on failures
   - Extensive logging for troubleshooting

5. User Experience
   - Reactive UI with Svelte components
   - One-click installation process
   - Direct access to logs and binaries
   - Clear dependency requirements
   - Links to all required and recommended plugins
   - Real-time status updates through Svelte stores

### Recommended Plugins
Added information about recommended plugins that enhance functionality:
- Templater: For template-based operations
- Smart Connections: For enhanced search capabilities
- Local REST API: Required for Obsidian communication

### Platform Compatibility
Implemented robust platform detection and path handling:
- Windows: Handles UNC paths and environment variables
- macOS: Proper binary permissions and config paths
- Linux: Flexible configuration for various distributions

### Future Considerations
1. Version Management
   - Consider automated update checks
   - Add update notifications
   - Implement rollback capability

2. Configuration
   - Add backup/restore of Claude config
   - Support custom binary locations
   - Allow custom log paths

3. Error Recovery
   - Add self-repair functionality
   - Implement health checks
   - Add diagnostic tools
