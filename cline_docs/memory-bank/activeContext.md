# Active Context

## Current Task
Implementing new tag search MCP tools that wrap DQL queries for Obsidian's tag-based search capabilities.

### Completed Implementation
1. search_tags
   - Implemented with ArkType validation
   - Supports include/exclude tag filtering
   - Optional folder path filtering
   - Returns file paths and tag lists
   - Proper error handling
   
2. list_file_tags
   - Implemented with ArkType validation
   - Optional folder path filtering
   - Returns sorted, unique tag list
   - Proper error handling

## Recent Changes
- Implemented both tag search tools in local-rest-api feature
- Added proper type definitions and validation
- Integrated with existing DQL search functionality
- Added comprehensive error handling

## Next Steps
1. Test tools with various tag combinations
2. Document usage examples
3. Update API documentation
4. Add to changelog
