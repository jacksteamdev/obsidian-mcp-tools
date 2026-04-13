/**
 * BDD specs for the shared logger module.
 *
 * Covers: getLogFilePath, formatMessage (via log output), createLogger,
 *         log level filtering, flush, config getter/setter, meta setter.
 */

// Public API surface (from packages/shared/src/logger.ts):
//   getLogFilePath(appName: string, fileName: string) -> string
//   logLevelSchema — arktype schema for log levels
//   loggerConfigMorph — arktype morph from InputLoggerConfig to FullLoggerConfig
//   createLogger(inputConfig: InputLoggerConfig) -> Logger
//   Logger.debug/info/warn/error/fatal(message, meta?) -> void
//   Logger.flush() -> Promise<void[]>
//   Logger.config (get) -> FullLoggerConfig
//   Logger.config (set) -> void (partial InputLoggerConfig)
//   Logger.meta (set) -> void

import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync } from "fs";
import { createLogger, getLogFilePath } from "./logger";

/**
 * REQUIREMENT: getLogFilePath returns platform-appropriate log directory paths.
 *
 * WHO: Any consumer that needs to locate log files on the filesystem
 * WHAT: 1. On macOS (darwin), returns ~/Library/Logs/<appName>/<fileName>
 *       2. Returns a string path containing the appName and fileName
 * WHY: Log files must be written to OS-conventional locations so users
 *      and support tools can find them without project-specific knowledge
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — uses real os.platform() and os.homedir()
 *     Real:  getLogFilePath
 *     Never: mock os.platform() — we test the current platform's branch
 */
describe("getLogFilePath", () => {
  test("returns a path containing the app name and file name", () => {
    /**
     * Given an application name and log file name
     * When getLogFilePath is called
     * Then the returned path contains both the app name and file name
     */

    // Given: app name and file name
    const appName = "test-app";
    const fileName = "test.log";

    // When: the log file path is resolved
    const result = getLogFilePath(appName, fileName);

    // Then: the path contains both identifiers
    expect(result).toContain(appName);
    expect(result).toContain(fileName);
  });
});

/**
 * REQUIREMENT: createLogger produces a logger that writes structured messages
 *              to a file, respects log level filtering, and supports runtime
 *              reconfiguration.
 *
 * WHO: All packages in the monorepo that import the shared logger
 * WHAT: 1. Logger writes formatted messages to the configured file path
 *       2. Messages below the configured level are filtered out
 *       3. flush() waits for all queued writes to complete
 *       4. config getter returns a copy of the current configuration
 *       5. config setter updates the log level and re-derives the level list
 *       6. meta setter attaches metadata to all subsequent log messages
 *       7. All five log methods (debug, info, warn, error, fatal) write when at level
 * WHY: Structured, level-filtered logging is essential for diagnosing issues
 *      in production without flooding disk with debug output
 *
 * MOCK BOUNDARY:
 *     Mock:  nothing — uses real filesystem via tmp directory
 *     Real:  createLogger, all log methods, flush, config, meta
 *     Never: mock fs.appendFile — use real filesystem with tmp cleanup
 */
describe("createLogger", () => {
  const logDir = getLogFilePath("test-app", "placeholder").replace(/placeholder$/, "");

  afterEach(() => {
    if (existsSync(logDir)) {
      rmSync(logDir, { recursive: true });
    }
  });

  test("writes a formatted message to the log file", async () => {
    /**
     * Given a logger configured at DEBUG level
     * When an error message is logged and flushed
     * Then the log file contains the formatted message with timestamp and level
     */

    // Given: a logger at DEBUG level
    const logger = createLogger({
      appName: "test-app",
      filename: "write-test.log",
      level: "DEBUG",
    });

    // When: a message is logged and flushed
    logger.error("something went wrong", { code: 42 });
    await logger.flush();

    // Then: the log file exists and contains the expected content
    const logPath = logger.config.filename;
    expect(existsSync(logPath)).toBe(true);
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[ERROR]");
    expect(content).toContain("something went wrong");
    expect(content).toContain('"code": 42');
  });

  test("filters messages below the configured log level", async () => {
    /**
     * Given a logger configured at WARN level
     * When debug and info messages are logged and flushed
     * Then those messages are not written to the log file
     */

    // Given: a logger at WARN level
    const logger = createLogger({
      appName: "test-app",
      filename: "filter-test.log",
      level: "WARN",
    });

    // When: sub-threshold messages are logged
    logger.debug("should not appear");
    logger.info("should not appear either");
    logger.warn("this should appear");
    await logger.flush();

    // Then: only the WARN message is in the log
    const logPath = logger.config.filename;
    const content = readFileSync(logPath, "utf-8");
    expect(content).not.toContain("[DEBUG]");
    expect(content).not.toContain("[INFO ]");
    expect(content).toContain("[WARN ]");
  });

  test("config getter returns a copy of the current configuration", () => {
    /**
     * Given a logger instance
     * When the config getter is accessed
     * Then it returns an object with the expected configuration properties
     */

    // Given: a logger
    const logger = createLogger({
      appName: "test-app",
      filename: "config-test.log",
      level: "INFO",
    });

    // When: config is accessed
    const config = logger.config;

    // Then: it contains the expected fields
    expect(config.appName).toBe("test-app");
    expect(config.level).toBe("INFO");
    expect(config.levels).toContain("INFO");
    expect(config.levels).toContain("ERROR");
    expect(config.levels).not.toContain("DEBUG");
  });

  test("config setter updates the log level at runtime", async () => {
    /**
     * Given a logger initially configured at ERROR level
     * When the config is updated to DEBUG level
     * Then debug messages are subsequently written to the log file
     */

    // Given: a logger at ERROR level
    const logger = createLogger({
      appName: "test-app",
      filename: "reconfig-test.log",
      level: "ERROR",
    });

    // When: level is changed to DEBUG
    logger.config = { level: "DEBUG" };
    logger.debug("now visible");
    await logger.flush();

    // Then: the debug message was written
    const logPath = logger.config.filename;
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[DEBUG]");
    expect(content).toContain("now visible");
  });

  test("meta setter attaches metadata to all subsequent log messages", async () => {
    /**
     * Given a logger with meta set to include a request ID
     * When a message is logged and flushed
     * Then the log entry contains the metadata fields
     */

    // Given: a logger with meta
    const logger = createLogger({
      appName: "test-app",
      filename: "meta-test.log",
      level: "DEBUG",
    });
    logger.meta = { requestId: "abc-123" };

    // When: a message is logged
    logger.info("processing request");
    await logger.flush();

    // Then: the metadata appears in the log output
    const logPath = logger.config.filename;
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("requestId");
    expect(content).toContain("abc-123");
  });

  test("all five log methods write when at DEBUG level", async () => {
    /**
     * Given a logger configured at DEBUG level (includes all levels)
     * When debug, info, warn, error, and fatal messages are each logged
     * Then all five messages appear in the log file
     */

    // Given: a logger at the lowest level
    const logger = createLogger({
      appName: "test-app",
      filename: "all-levels-test.log",
      level: "DEBUG",
    });

    // When: every log method is called
    logger.debug("debug msg");
    logger.info("info msg");
    logger.warn("warn msg");
    logger.error("error msg");
    logger.fatal("fatal msg");
    await logger.flush();

    // Then: all five levels appear in the output
    const logPath = logger.config.filename;
    const content = readFileSync(logPath, "utf-8");
    expect(content).toContain("[DEBUG]");
    expect(content).toContain("[INFO ]");
    expect(content).toContain("[WARN ]");
    expect(content).toContain("[ERROR]");
    expect(content).toContain("[FATAL]");
  });

  test("formats message without metadata when meta is empty", async () => {
    /**
     * Given a logger with no metadata set
     * When a message is logged without per-call meta
     * Then the log entry contains only the timestamp, level, and message
     */

    // Given: a logger with no meta, at DEBUG level
    const logger = createLogger({
      appName: "test-app",
      filename: "no-meta-test.log",
      level: "DEBUG",
    });

    // When: a message is logged without meta
    logger.info("simple message");
    await logger.flush();

    // Then: the log line has no JSON metadata block
    const logPath = logger.config.filename;
    const content = readFileSync(logPath, "utf-8");
    const lines = content.trim().split("\n");
    // A message without meta should be a single line (no JSON block follows)
    expect(lines.length).toBe(1);
    expect(lines[0]).toContain("[INFO ]");
    expect(lines[0]).toContain("simple message");
  });
});
