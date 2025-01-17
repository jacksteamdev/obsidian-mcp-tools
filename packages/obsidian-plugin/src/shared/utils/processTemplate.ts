import { LocalRestAPI, Templater } from "$/shared";
import type { TFile } from "obsidian";
import type { PromptArgAccessor } from "shared";

/**
 * Processes a template file with the provided parameters and returns the processed content.
 *
 * @param templater - The Templater instance to use for processing the template.
 * @param params - The parameters to use when processing the template.
 * @param template - The template file to process.
 * @param target - The optional target file to write the processed content to.
 * @returns A Promise that resolves with the processed content.
 */
export async function processTemplate(
  templater: Templater.ITemplater,
  params: LocalRestAPI.ApiTemplateExecutionParamsType,
  template: TFile,
  target?: TFile,
) {
  const { path } = target ?? template;

  // Start template task
  templater.start_templater_task?.(path);

  try {
    const config = templater.create_running_config(
      template,
      target || template,
      Templater.RunMode.CreateNewFromTemplate,
    );

    const prompt: PromptArgAccessor = (argName: string) => {
      return params.arguments[argName] ?? "";
    };

    const oldGenerateObject =
      templater.functions_generator.generate_object.bind(
        templater.functions_generator,
      );

    // Override generate_object to inject arg into user functions
    templater.functions_generator.generate_object = async function (
      config,
      functions_mode,
    ) {
      const functions = await oldGenerateObject(config, functions_mode);
      Object.assign(functions, { mcpTools: { prompt } });
      return functions;
    };

    // Process template with variables
    const processedContent = await templater.read_and_parse_template(config);

    // Restore original functions generator
    templater.functions_generator.generate_object = oldGenerateObject;

    // Write processed content to target file if it exists
    if (path !== template.path) target?.vault.modify(target, processedContent);

    // Wait for all templates to be executed and return processed content
    return new Promise<string>((resolve, reject) => {
      setTimeout(() => {
        reject(new Error(`Template processing timed out: ${path}`));
      }, 10000);
      templater.current_functions_object.hooks.on_all_templates_executed(() => {
        // Some templates may be updated by on_all_templates_executed
        setTimeout(() => {
          // Return cached content if target file is not provided
          resolve(target?.vault.cachedRead(target) ?? processedContent);
        }, 10);
      });
    });
  } finally {
    // Always end template task and trigger on_all_templates_executed
    templater.end_templater_task?.(path);
  }
}
