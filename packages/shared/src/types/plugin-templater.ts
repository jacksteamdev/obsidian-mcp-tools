import {
  App,
  type MarkdownPostProcessorContext,
  TAbstractFile,
  TFile,
  TFolder,
} from "obsidian";

export enum RunMode {
  CreateNewFromTemplate,
  AppendActiveFile,
  OverwriteFile,
  OverwriteActiveFile,
  DynamicProcessor,
  StartupTemplate,
}

export enum FunctionsMode {
  INTERNAL,
  USER_INTERNAL,
}

export type RunningConfig = {
  template_file: TFile | undefined;
  target_file: TFile;
  run_mode: RunMode;
  active_file?: TFile | null;
};

interface TemplaterFunctions {
  app: App;
  config: RunningConfig;
  date: {
    /**
     * @param format "YYYY-MM-DD"
     * @param offset
     * @param reference
     * @param reference_format
     */
    now(
      format: string,
      offset?: number | string,
      reference?: string,
      reference_format?: string,
    ): string;
    /**
     * @param format "YYYY-MM-DD"
     */
    tomorrow(format: string): string;
    /**
     * @param format "YYYY-MM-DD"
     * @param weekday
     * @param reference
     * @param reference_format
     */
    weekday(
      format: string,
      weekday: number,
      reference?: string,
      reference_format?: string,
    ): string;
    /**
     * @param format "YYYY-MM-DD"
     */
    yesterday(format?: string): string;
  };
  file: {
    content: string;
    /**
     * @param template TFile or string
     * @param filename
     * @param open_new Default: false
     * @param folder TFolder or string
     */
    create_new(
      template: TFile | string,
      filename?: string,
      open_new?: boolean,
      folder?: TFolder | string,
    ): Promise<TFile>;
    /**
     * @param format Default: "YYYY-MM-DD HH:mm"
     */
    creation_date(format?: string): string;
    /**
     * @param order
     */
    cursor(order?: number): void;
    cursor_append(content: string): void;
    exists(filepath: string): boolean;
    find_tfile(filename: string): TFile;
    /**
     * @param absolute Default: false
     */
    folder(absolute?: boolean): string;
    include(include_link: string | TFile): string;
    /**
     * @param format Default: "YYYY-MM-DD HH:mm"
     */
    last_modified_date(format?: string): string;
    move(new_path: string, file_to_move?: TFile): Promise<void>;
    /**
     * @param relative Default: false
     */
    path(relative?: boolean): string;
    rename(new_title: string): Promise<void>;
    selection(): string;
    tags: string[];
    title: string;
  };
  frontmatter: Record<string, unknown>;
  hooks: {
    on_all_templates_executed(cb: () => void): void;
  };
  system: {
    /**
     * Retrieves the clipboard's content.
     */
    clipboard(): Promise<string>;

    /**
     * @param prompt_text
     * @param default_value
     * @param throw_on_cancel Default: false
     * @param multiline Default: false
     */
    prompt(
      prompt_text?: string,
      default_value?: string,
      throw_on_cancel?: boolean,
      multiline?: boolean,
    ): Promise<string>;

    /**
     * @param text_items String array or function mapping item to string
     * @param items Array of generic type T
     * @param throw_on_cancel Default: false
     * @param placeholder Default: ""
     * @param limit Default: undefined
     */
    suggester<T>(
      text_items: string[] | ((item: T) => string),
      items: T[],
      throw_on_cancel?: boolean,
      placeholder?: string,
      limit?: number,
    ): Promise<T>;
  };
  web: {
    /**
     * Retrieves daily quote from quotes database
     */
    daily_quote(): Promise<string>;

    /**
     * @param size Image size specification
     * @param query Search query
     * @param include_size Whether to include size in URL
     */
    random_picture(
      size: string,
      query: string,
      include_size: boolean,
    ): Promise<string>;

    /**
     * @param url Full URL to request
     * @param path Optional path parameter
     */
    request(url: string, path?: string): Promise<string>;
  };
  user: Record<string, unknown>;
}

export interface ITemplater {
  setup(): Promise<void>;
  /** Generate the config required to parse a template */
  create_running_config(
    template_file: TFile | undefined,
    target_file: TFile,
    run_mode: RunMode,
  ): RunningConfig;
  /** I don't think this writes the file, but the config requires the file name */
  read_and_parse_template(config: RunningConfig): Promise<string>;
  /** I don't think this writes the file, but the config requires the file name */
  parse_template(
    config: RunningConfig,
    template_content: string,
  ): Promise<string>;
  create_new_note_from_template(
    template: TFile | string,
    folder?: TFolder | string,
    filename?: string,
    open_new_note?: boolean,
  ): Promise<TFile | undefined>;
  append_template_to_active_file(template_file: TFile): Promise<void>;
  write_template_to_file(template_file: TFile, file: TFile): Promise<void>;
  overwrite_active_file_commands(): void;
  overwrite_file_commands(file: TFile, active_file?: boolean): Promise<void>;
  process_dynamic_templates(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): Promise<void>;
  get_new_file_template_for_folder(folder: TFolder): string | undefined;
  get_new_file_template_for_file(file: TFile): string | undefined;
  execute_startup_scripts(): Promise<void>;
  start_templater_task?(path: string): void;
  end_templater_task?(path: string): void;

  on_file_creation(
    templater: ITemplater,
    app: App,
    file: TAbstractFile,
  ): Promise<void>;

  current_functions_object: TemplaterFunctions;
  functions_generator: {
    generate_object(
      config: RunningConfig,
      functions_mode?: FunctionsMode,
    ): Promise<TemplaterFunctions>;
  };
}
