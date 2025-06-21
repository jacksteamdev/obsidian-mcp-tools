## Description

This PR fixes an issue where the Smart Connections plugin is not detected by MCP Tools on Linux systems, even though Smart Connections is installed and fully functional.

## Problem

On Linux, Smart Connections doesn't consistently expose its API via `window.SmartSearch`. Instead, it's accessible through Obsidian's plugin system at `app.plugins.plugins["smart-connections"].env`.

## Solution

Added a fallback detection mechanism that:
1. First checks `window.SmartSearch` (works on some platforms)
2. Falls back to checking `app.plugins.plugins["smart-connections"].env` (fixes Linux)
3. Caches the API reference in `window.SmartSearch` for consistency

## Changes

- Modified `loadSmartSearchAPI` function in `packages/obsidian-plugin/src/shared/index.ts`
- Added TypeScript type definitions for the smart-connections plugin interface
- Added proper typing for the `env` property on the smart-connections plugin

## Testing

Tested on Linux (Ubuntu) with:
- Obsidian v1.5.x
- MCP Tools v0.2.22
- Smart Connections v3.0.39

Before fix: Smart Connections shows as ❌ not installed
After fix: Smart Connections shows as ✅ installed

## Screenshots

Before:
![image](https://github.com/user-attachments/assets/your-before-screenshot)

After:
![image](https://github.com/user-attachments/assets/your-after-screenshot)

## Related Issues

Fixes detection issue on Linux systems where Smart Connections is functional but not detected.
