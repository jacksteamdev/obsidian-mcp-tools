import { type } from "arktype";
import { existsSync, mkdirSync } from "fs";
import { appendFile } from "fs/promises";
import { homedir, platform } from "os";
import { dirname, resolve } from "path";

/**
 * Determines the appropriate log directory path based on the current operating system.
 * @param appName - The name of the application to use in the log directory path.
 * @param fileName - The name of the log file.
 * @param _platform - Override for the OS platform (defaults to os.platform()).
 * @returns The full path to the log directory for the current operating system.
 * @throws {Error} If the current operating system is not supported.
 */
export function getLogFilePath(appName: string, fileName: string, _platform?: string) {
  switch (_platform ?? platform()) {
    case "darwin": // macOS
      return resolve(homedir(), "Library", "Logs", appName, fileName);

    case "win32": // Windows
      return resolve(homedir(), "AppData", "Local", "Logs", appName, fileName);

    case "linux": // Linux
      return resolve(homedir(), ".local", "share", "logs", appName, fileName);

    default:
      throw new Error("Unsupported operating system");
  }
}

const ensureDirSync = (dirPath: string) => {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
};

const logLevels = ["DEBUG", "INFO", "WARN", "ERROR", "FATAL"] as const;
export const logLevelSchema = type.enumerated(...logLevels);
export type LogLevel = typeof logLevelSchema.infer;

const formatMessage = (
  level: LogLevel,
  message: unknown,
  meta: Record<string, unknown>,
) => {
  const timestamp = new Date().toISOString();
  const metaStr = Object.keys(meta).length
    ? `\n${JSON.stringify(meta, null, 2)}`
    : "";
  return `${timestamp} [${level.padEnd(5)}] ${JSON.stringify(
    message,
  )}${metaStr}\n`;
};

const loggerConfigSchema = type({
  appName: "string",
  filename: "string",
  level: logLevelSchema,
});
export const loggerConfigMorph = loggerConfigSchema.pipe((config) => {
  const filename = getLogFilePath(config.appName, config.filename);
  const levels = logLevels.slice(logLevels.indexOf(config.level));
  return { ...config, levels, filename };
});

export type InputLoggerConfig = typeof loggerConfigSchema.infer;
export type FullLoggerConfig = typeof loggerConfigMorph.infer;

/**
 * Creates a logger instance with configurable options for logging to a file.
 * The logger provides methods for logging messages at different log levels (DEBUG, INFO, WARN, ERROR, FATAL).
 * @param config - An object with configuration options for the logger.
 * @param config.filepath - The file path to use for logging to a file.
 * @param config.level - The minimum log level to log messages.
 * @returns An object with logging methods (debug, info, warn, error, fatal).
 */
export function createLogger(inputConfig: InputLoggerConfig) {
  let config: FullLoggerConfig = loggerConfigMorph.assert(inputConfig);
  let logMeta: Record<string, unknown> = {};

  const queue: Promise<void>[] = [];
  const log = (level: LogLevel, message: unknown, meta?: typeof logMeta) => {
    if (!config.levels.includes(level)) return;
    ensureDirSync(dirname(getLogFilePath(config.appName, config.filename)));
    queue.push(
      appendFile(
        config.filename,
        formatMessage(level, message, { ...logMeta, ...(meta ?? {}) }),
      ),
    );
  };

  const debug = (message: unknown, meta?: typeof logMeta) =>
    log("DEBUG", message, meta);
  const info = (message: unknown, meta?: typeof logMeta) =>
    log("INFO", message, meta);
  const warn = (message: unknown, meta?: typeof logMeta) =>
    log("WARN", message, meta);
  const error = (message: unknown, meta?: typeof logMeta) =>
    log("ERROR", message, meta);
  const fatal = (message: unknown, meta?: typeof logMeta) =>
    log("FATAL", message, meta);

  const logger = {
    debug,
    info,
    warn,
    error,
    fatal,
    flush() {
      return Promise.all(queue);
    },
    get config(): FullLoggerConfig {
      return { ...config };
    },
    /**
     * Updates the configuration of the logger instance.
     * @param newConfig - A partial configuration object to merge with the existing configuration.
     * This method updates the log levels based on the new configuration level, and then merges the new configuration with the existing configuration.
     */
    set config(newConfig: Partial<InputLoggerConfig>) {
      config = loggerConfigMorph.assert({ ...config, ...newConfig });
      logger.debug("Updated logger configuration", { config });
    },
    set meta(newMeta: Record<string, unknown>) {
      logMeta = newMeta;
    },
  };

  return logger;
}
