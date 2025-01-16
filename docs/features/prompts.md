# Prompts Feature Requirements

## Overview

The Prompts feature enables users to create and use templated prompts stored in their Obsidian vault. These prompts can be used to instruct MCP clients (like Claude or Cline) on how to interact with the Obsidian vault or define specific workflows. The system integrates with Obsidian's Templater plugin for template processing and uses ArkType for robust argument validation.

### Key Benefits

1. Template-based Prompts:

   - Create reusable prompt templates with dynamic parameters
   - Access to Templater's advanced functionality (e.g., DataView integration)
   - Store and organize prompts within your Obsidian vault

2. MCP Client Integration:
   - Seamless integration with MCP clients
   - Parameter validation before execution
   - Structured message formatting

## Implementation Location

The prompts feature is implemented in the MCP server package under `src/features/prompts`.

## Core Functionality

1. Prompt Storage:

   - Prompts stored in dedicated "Prompts" directory in vault
   - Files must be Markdown format (.md)
   - Files must include "mcp-tools-prompt" tag
   - Frontmatter must include description

2. Prompt Structure:

   ```markdown
   ---
   description: Description of what this prompt does
   tags:
     - mcp-tools-prompt
   ---

   Your prompt content here with <% tp.mcpTools.prompt("content") %>
   ```

3. Template Parameters:
   - Uses Templater syntax via `tp.mcpTools.prompt(promptName)`
   - Parameters extracted and validated
   - Arguments provided during prompt retrieval
   - Runtime validation using ArkType schemas

### Technical Considerations

1. Template Execution:
   - `tp.mcpTools.prompt()` is synchronous
   - Parameter values must be provided before template execution
   - Avoid Templater features requiring user interaction (e.g., `tp.system.prompt`)
   - Obsidian app may not be in focus during execution

## Feature Endpoints

1. List Prompts:

   - Lists all available prompts in vault
   - Filters for .md files with required tag
   - Returns metadata including:
     - File name
     - Description from frontmatter
     - Available template parameters

2. Get Prompt:
   - Retrieves specific prompt by name
   - Validates provided arguments
   - Processes template with Templater
   - Returns formatted message content

## Integration Requirements

1. Obsidian Plugins:

   - Local REST API for vault access
   - Templater for template processing

2. File Access:
   - Read access to vault directory
   - Ability to process frontmatter
   - Permission to execute templates

## Error Handling

1. Validation Errors:

   - Invalid template parameters
   - Missing required arguments
   - Malformed frontmatter
   - Missing description

2. File System Errors:

   - Missing prompt files
   - Access permission issues
   - Invalid file formats

3. Template Processing Errors:
   - Template syntax errors
   - Processing failures
   - Plugin integration issues

## Implementation Details

### Feature Organization

```
src/features/prompts/
└── index.ts         # Core implementation
```

### Key Implementation Decisions

1. Prompt Discovery

   - Uses dedicated "Prompts" directory
   - Requires specific tag for identification
   - Validates file format and structure

2. Template Processing

   - Leverages Templater plugin
   - Extracts parameters automatically
   - Builds dynamic validation schemas

3. Response Format

   - Returns structured message objects
   - Includes prompt description
   - Supports text content type

4. Error Management
   - Comprehensive error formatting
   - Detailed logging for debugging
   - Clear user feedback

### Future Considerations

1. Settings UI Development

   - Add configuration for Prompts directory location
   - Add configuration for prompt identification tag
   - Consider adding template parameter validation preview

2. Validation Improvements

   - Evaluate current validation strictness
   - Consider adding template syntax validation
   - Add helpful error messages for common issues

3. Documentation
   - Add examples of DataView integration
   - Document common template patterns
   - Provide troubleshooting guide

## Usage Example

1. Create a prompt file:

   ```markdown
   ---
   description: Generate a creative story about a character
   ---

   Write a short story about a <% tp.mcpTools.prompt("character_type") %> named <% tp.mcpTools.prompt("character_name") %> who lives in <% tp.mcpTools.prompt("setting") %>.
   ```

2. List available prompts:

   ```typescript
   // Returns metadata about all prompts
   const { prompts } = await server.request(ListPromptsRequestSchema, {});
   ```

3. Get processed prompt:
   ```typescript
   // Get specific prompt with arguments
   const result = await server.request(GetPromptRequestSchema, {
     name: "story-prompt.md",
     arguments: {
       character_type: "wizard",
       character_name: "Merlin",
       setting: "ancient Britain",
     },
   });
   ```

## Appendix: Implementation Insights

### Template Parameter Handling

The feature uses a robust approach to template parameter handling:

1. Parameter Extraction:

   ```typescript
   const templateParams = parseTemplateParameters(template);
   const templateParamsSchema = buildTemplateArgumentsSchema(templateParams);
   ```

2. Argument Validation:
   ```typescript
   const templateArgs = templateParamsSchema(params.arguments);
   if (templateArgs instanceof type.errors) {
     throw new McpError(
       ErrorCode.InvalidParams,
       `Invalid arguments: ${templateArgs.summary}`,
     );
   }
   ```

### Frontmatter Processing

Frontmatter validation ensures proper prompt metadata:

```typescript
const { description } = PromptFrontmatterSchema.assert(frontmatter);
```

### Message Formatting

Responses are formatted as structured messages:

```typescript
{
  messages: [
    {
      description,
      role: "user",
      content: {
        type: "text",
        text: processedContent,
      },
    },
  ];
}
```
