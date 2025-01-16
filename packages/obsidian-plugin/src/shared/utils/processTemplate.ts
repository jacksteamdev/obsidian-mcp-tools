import { LocalRestAPI, Templater } from "$/shared";
import type { TFile } from "obsidian";
import type { PromptArgAccessor } from "shared";

export async function processTemplate(
  template: TFile,
  target: TFile,
  params: LocalRestAPI.ApiTemplateExecutionParamsType,
  templater: Templater.ITemplater,
) {
  const config = templater.create_running_config(
    template,
    target,
    Templater.RunMode.CreateNewFromTemplate,
  );

  const prompt: PromptArgAccessor = (argName: string) => {
    return params.arguments[argName] ?? "";
  };

  const oldGenerateObject = templater.functions_generator.generate_object.bind(
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

  return processedContent;
}
