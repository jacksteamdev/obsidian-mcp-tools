# Active Context

## Current Focus
Implementing related content functionality for source document feature, using existing Smart Connections integration pattern from search implementation.

## Recent Changes
1. Prepared types for related content:
   - Added "related?" parameter to readParams
   - Added "related?" field to readResponse
   - Using searchResult.array() for related content type

2. Analyzed existing Smart Connections integration:
   - Search endpoint already implements Smart Connections
   - Pattern available for loading and using Smart Connections API
   - Error handling and fallback logic established

3. Consolidated types in shared package:
   - Moved all source document types to shared/types/source-documents.ts
   - Renamed schemas for clarity and consistency
   - Updated imports to use new type organization

## Implementation Status
- ✅ Settings stage complete (docs/features/source-document/settings.md)
- ✅ Create stage complete (docs/features/source-document/create.md)
- ⏳ Read stage in progress:
  - ✅ Base pagination functionality
  - ✅ Type definitions for related content
  - 📋 Related content implementation:
    * Use searchRoute pattern for Smart Connections
    * Update GET /sources/:origin/:id endpoint
    * Add related content to response
    * Reuse existing error handling
- ✅ Search stage complete (docs/features/source-document/search.md)

## Next Steps
1. Update Read Endpoint:
   - Add related parameter handling (like search endpoint)
   - Use loadSmartSearchAPI pattern from search implementation
   - Add related content to response using searchDocuments service
   - Maintain existing error handling pattern

2. Testing:
   - Follow search endpoint testing pattern
   - Test with and without Smart Connections
   - Verify error handling matches search endpoint
   - Test response format

3. Documentation:
   - Document related content similar to search
   - Add examples showing both features
   - Update API documentation
