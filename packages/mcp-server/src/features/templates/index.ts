import {
  formatMcpError,
  makeRequest,
  parseTemplateParameters,
  type ToolRegistry,
} from "$/shared";
import { type } from "arktype";
import { buildTemplateArgumentsSchema, LocalRestAPI } from "shared";

export function registerTemplaterTools(tools: ToolRegistry) {
  tools.register(
    type({
      name: '"execute_template"',
      arguments: LocalRestAPI.ApiTemplateExecutionParams.omit("createFile").and(
        {
          // should be boolean but the MCP client returns a string
          "createFile?": type("'true'|'false'").describe(
            "Whether to create a new file from the template. Optional.",
          ),
        },
      ),
    }).describe(
      "Execute a Templater template with the given arguments. " +
        "IMPORTANT: The 'name' argument is required. " +
        "Example: { name: 'templates/daily-note.md', arguments: { title: 'My Title' }, createFile: 'true', targetPath: 'notes/output.md' }",
    ),
    async ({ arguments: args }) => {
      // Get prompt content
      const data = await makeRequest(
        LocalRestAPI.ApiVaultFileResponse,
        `/vault/${args.name}`,
        {
          headers: { Accept: LocalRestAPI.MIME_TYPE_OLRAPI_NOTE_JSON },
        },
      );

      // Validate prompt arguments
      const templateParameters = parseTemplateParameters(data.content);
      const validArgs = buildTemplateArgumentsSchema(templateParameters)(
        args.arguments,
      );
      if (validArgs instanceof type.errors) {
        throw formatMcpError(validArgs);
      }

      const templateExecutionArgs: {
        name: string;
        arguments: Record<string, string>;
        createFile: boolean;
        targetPath?: string;
      } = {
        name: args.name,
        arguments: validArgs,
        createFile: args.createFile === "true",
        targetPath: args.targetPath,
      };

      // Process template through Templater plugin
      const response = await makeRequest(
        LocalRestAPI.ApiTemplateExecutionResponse,
        "/templates/execute",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(templateExecutionArgs),
        },
      );

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    },
  );
}
