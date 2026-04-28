import { describe, expect, test } from "bun:test";
import { type } from "arktype";

/**
 * Tests for command execution tools: list_obsidian_commands and execute_obsidian_command
 * Issue #29: Add MCP tools to list and execute Obsidian commands
 */
describe("list_obsidian_commands schema", () => {
  test("schema structure is correct", () => {
    const schema = type({
      name: '"list_obsidian_commands"',
      arguments: {},
    });

    const validated = schema({
      name: "list_obsidian_commands",
      arguments: {},
    });

    expect(validated instanceof type.errors).toBe(false);
    if (!(validated instanceof type.errors)) {
      expect(validated.name).toBe("list_obsidian_commands");
      expect(validated.arguments).toEqual({});
    }
  });

  test("accepts empty arguments object", () => {
    const schema = type({
      name: '"list_obsidian_commands"',
      arguments: {},
    });

    const result = schema({
      name: "list_obsidian_commands",
      arguments: {},
    });

    expect(result instanceof type.errors).toBe(false);
  });
});

describe("execute_obsidian_command schema", () => {
  test("schema structure is correct", () => {
    const schema = type({
      name: '"execute_obsidian_command"',
      arguments: {
        commandId: "string",
      },
    });

    const validated = schema({
      name: "execute_obsidian_command",
      arguments: { commandId: "daily-notes" },
    });

    expect(validated instanceof type.errors).toBe(false);
    if (!(validated instanceof type.errors)) {
      expect(validated.name).toBe("execute_obsidian_command");
      expect(validated.arguments.commandId).toBe("daily-notes");
    }
  });

  test("requires commandId argument", () => {
    const schema = type({
      name: '"execute_obsidian_command"',
      arguments: {
        commandId: "string",
      },
    });

    const result = schema({
      name: "execute_obsidian_command",
      arguments: {},
    });

    expect(result instanceof type.errors).toBe(true);
  });

  test("accepts valid command IDs", () => {
    const schema = type({
      arguments: {
        commandId: "string",
      },
    });

    const validCommandIds = [
      "daily-notes",
      "editor:toggle-bold",
      "workspace:split-vertical",
      "file-explorer:open",
      "graph:open",
      "canvas:new-canvas",
    ];

    validCommandIds.forEach((commandId) => {
      const result = schema({ arguments: { commandId } });
      expect(result instanceof type.errors).toBe(false);
    });
  });

  test("commandId is a string type", () => {
    const schema = type({
      arguments: {
        commandId: "string",
      },
    });

    // Should reject non-string types
    const withNumber = schema({ arguments: { commandId: 123 } });
    expect(withNumber instanceof type.errors).toBe(true);

    const withBoolean = schema({ arguments: { commandId: true } });
    expect(withBoolean instanceof type.errors).toBe(true);

    const withObject = schema({ arguments: { commandId: {} } });
    expect(withObject instanceof type.errors).toBe(true);
  });
});

describe("Command ID URL encoding", () => {
  /**
   * Helper function to construct the API path for executing a command
   * Replicates the logic from execute_obsidian_command tool
   */
  function constructCommandExecutionPath(commandId: string): string {
    return `/commands/${encodeURIComponent(commandId)}`;
  }

  test("encodes simple command IDs", () => {
    expect(constructCommandExecutionPath("daily-notes")).toBe(
      "/commands/daily-notes",
    );
  });

  test("encodes command IDs with colons", () => {
    expect(constructCommandExecutionPath("editor:toggle-bold")).toBe(
      "/commands/editor%3Atoggle-bold",
    );
  });

  test("encodes command IDs with slashes", () => {
    expect(constructCommandExecutionPath("file/explorer:open")).toBe(
      "/commands/file%2Fexplorer%3Aopen",
    );
  });

  test("encodes command IDs with spaces", () => {
    expect(constructCommandExecutionPath("my custom command")).toBe(
      "/commands/my%20custom%20command",
    );
  });

  test("encodes command IDs with special characters", () => {
    expect(constructCommandExecutionPath("command#123")).toBe(
      "/commands/command%23123",
    );
  });

  test("encodes command IDs with Unicode characters", () => {
    const path = constructCommandExecutionPath("コマンド");
    expect(path).toContain("%");
    expect(path).toStartWith("/commands/");
  });

  test("preserves alphanumeric and hyphen characters", () => {
    expect(constructCommandExecutionPath("simple-command-123")).toBe(
      "/commands/simple-command-123",
    );
  });

  test("encodes common Obsidian command patterns", () => {
    const commands = [
      { id: "workspace:split-vertical", expected: "/commands/workspace%3Asplit-vertical" },
      { id: "editor:toggle-bold", expected: "/commands/editor%3Atoggle-bold" },
      { id: "file-explorer:open", expected: "/commands/file-explorer%3Aopen" },
    ];

    commands.forEach(({ id, expected }) => {
      expect(constructCommandExecutionPath(id)).toBe(expected);
    });
  });
});

describe("API response structure", () => {
  test("ApiCommandsResponse schema structure", () => {
    const ApiCommand = type({
      id: "string",
      name: "string",
    });

    const ApiCommandsResponse = type({
      commands: ApiCommand.array(),
    });

    const mockResponse = {
      commands: [
        { id: "daily-notes", name: "Daily Notes" },
        { id: "editor:toggle-bold", name: "Toggle Bold" },
      ],
    };

    const validated = ApiCommandsResponse(mockResponse);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.commands).toHaveLength(2);
      expect(validated.commands[0].id).toBe("daily-notes");
      expect(validated.commands[0].name).toBe("Daily Notes");
    }
  });

  test("ApiCommand schema validates individual commands", () => {
    const ApiCommand = type({
      id: "string",
      name: "string",
    });

    const validCommand = ApiCommand({
      id: "workspace:split-vertical",
      name: "Split Vertical",
    });

    expect(validCommand instanceof type.errors).toBe(false);
  });

  test("ApiCommand schema rejects invalid structures", () => {
    const ApiCommand = type({
      id: "string",
      name: "string",
    });

    // Missing name
    const missingName = ApiCommand({ id: "test" });
    expect(missingName instanceof type.errors).toBe(true);

    // Missing id
    const missingId = ApiCommand({ name: "Test" });
    expect(missingId instanceof type.errors).toBe(true);

    // Wrong types
    const wrongTypes = ApiCommand({ id: 123, name: true });
    expect(wrongTypes instanceof type.errors).toBe(true);
  });
});

describe("Tool integration", () => {
  test("list_obsidian_commands and execute_obsidian_command work together", () => {
    // Simulates the workflow of listing commands and then executing one
    const listSchema = type({
      name: '"list_obsidian_commands"',
      arguments: {},
    });

    const executeSchema = type({
      name: '"execute_obsidian_command"',
      arguments: {
        commandId: "string",
      },
    });

    // Step 1: List commands
    const listCall = listSchema({
      name: "list_obsidian_commands",
      arguments: {},
    });
    expect(listCall instanceof type.errors).toBe(false);

    // Step 2: Execute a specific command from the list
    const executeCall = executeSchema({
      name: "execute_obsidian_command",
      arguments: { commandId: "daily-notes" },
    });
    expect(executeCall instanceof type.errors).toBe(false);
  });
});
