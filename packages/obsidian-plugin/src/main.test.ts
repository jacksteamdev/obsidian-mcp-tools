import { describe, expect, test, mock, beforeEach, afterEach } from "bun:test";
import { of, throwError } from "rxjs";
import McpToolsPlugin from "./main";
import type { Dependencies } from "./shared";
import type { LocalRestApiPublicApi } from "obsidian-local-rest-api";

// Mock dependencies
const mockLoadLocalRestAPI = mock(() => of({} as Dependencies["obsidian-local-rest-api"]));
const mockNotice = mock(() => {});
const mockLogger = {
  info: mock(() => {}),
  error: mock(() => {}),
  warn: mock(() => {}),
  debug: mock(() => {}),
};

// Mock modules
mock.module("./shared", () => ({
  loadLocalRestAPI: mockLoadLocalRestAPI,
  logger: mockLogger,
}));

mock.module("obsidian", () => ({
  Plugin: class Plugin {
    app = {
      plugins: {
        plugins: {},
      },
    };
    manifest = {
      name: "MCP Tools Test",
    };
    async load() {}
    async onload() {}
  },
  Notice: mockNotice,
}));

mock.module("./features/core", () => ({
  setup: mock(async () => {}),
}));

mock.module("./features/mcp-server-install", () => ({
  setup: mock(async () => {}),
}));

describe("McpToolsPlugin - Local REST API version checking and error handling", () => {
  beforeEach(() => {
    // Reset mocks before each test
    mockLoadLocalRestAPI.mockClear();
    mockNotice.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  describe("Version checking", () => {
    test("successfully loads when API has addRoute function", async () => {
      const mockAddRoute = mock(() => ({
        post: mock(() => {}),
      }));

      const mockApi: Partial<LocalRestApiPublicApi> = {
        addRoute: mockAddRoute,
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify addRoute was called for both endpoints
      expect(mockAddRoute).toHaveBeenCalledWith("/search/smart");
      expect(mockAddRoute).toHaveBeenCalledWith("/templates/execute");

      // Verify success logs
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Registered endpoint: POST /search/smart",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Registered endpoint: POST /templates/execute",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "MCP Tools Plugin loaded successfully",
      );

      // Verify no error notices
      expect(mockNotice).not.toHaveBeenCalled();
    });

    test("shows error when API is not found", async () => {
      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: false,
        api: undefined,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Local REST API plugin is required but not found. Please install it from the community plugins and restart Obsidian.",
        0,
      );

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Local REST API plugin not found",
      );
    });

    test("shows error when API version is outdated (no addRoute function)", async () => {
      // API exists but doesn't have addRoute function (outdated version)
      const mockApi: Partial<LocalRestApiPublicApi> = {
        // addRoute is intentionally missing
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify outdated version notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Local REST API plugin version is outdated. Please update to version 2.5.4 or later to enable custom endpoints.",
        0,
      );

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Local REST API plugin does not support addRoute API",
      );
    });

    test("shows error when addRoute is not a function", async () => {
      const mockApi: Partial<LocalRestApiPublicApi> = {
        // @ts-expect-error - Testing invalid type
        addRoute: "not a function",
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify outdated version notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Local REST API plugin version is outdated. Please update to version 2.5.4 or later to enable custom endpoints.",
        0,
      );
    });
  });

  describe("Error handling during endpoint registration", () => {
    test("handles errors when addRoute throws exception", async () => {
      const mockAddRoute = mock(() => {
        throw new Error("Failed to add route");
      });

      const mockApi: Partial<LocalRestApiPublicApi> = {
        addRoute: mockAddRoute,
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to register endpoints",
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );

      // Verify error notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Failed to register API endpoints. Error: Failed to add route",
        0,
      );
    });

    test("handles errors when post() throws exception", async () => {
      const mockPost = mock(() => {
        throw new Error("Failed to register POST handler");
      });

      const mockAddRoute = mock(() => ({
        post: mockPost,
      }));

      const mockApi: Partial<LocalRestApiPublicApi> = {
        addRoute: mockAddRoute,
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to register endpoints",
        expect.objectContaining({
          error: expect.any(Error),
        }),
      );

      // Verify error notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Failed to register API endpoints. Error: Failed to register POST handler",
        0,
      );
    });

    test("handles non-Error exceptions during registration", async () => {
      const mockAddRoute = mock(() => {
        throw "String error";
      });

      const mockApi: Partial<LocalRestApiPublicApi> = {
        addRoute: mockAddRoute,
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to register endpoints",
        expect.objectContaining({
          error: "String error",
        }),
      );

      // Verify error notice was shown with string conversion
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Failed to register API endpoints. Error: String error",
        0,
      );
    });
  });

  describe("Error handling during plugin loading", () => {
    test("handles errors when loadLocalRestAPI observable fails", async () => {
      const testError = new Error("Failed to load Local REST API plugin");
      mockLoadLocalRestAPI.mockImplementation(() =>
        throwError(() => testError),
      );

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to load Local REST API plugin",
        expect.objectContaining({
          error: testError,
        }),
      );

      // Verify error notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Failed to load Local REST API plugin. Please ensure it is installed and enabled.",
        0,
      );
    });

    test("handles errors when loadLocalRestAPI rejects with non-Error", async () => {
      mockLoadLocalRestAPI.mockImplementation(() =>
        throwError(() => "Unknown error"),
      );

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify error was logged
      expect(mockLogger.error).toHaveBeenCalledWith(
        "Failed to load Local REST API plugin",
        expect.objectContaining({
          error: "Unknown error",
        }),
      );

      // Verify error notice was shown
      expect(mockNotice).toHaveBeenCalledWith(
        "MCP Tools Test: Failed to load Local REST API plugin. Please ensure it is installed and enabled.",
        0,
      );
    });
  });

  describe("Logging behavior", () => {
    test("logs each endpoint registration separately", async () => {
      const mockAddRoute = mock(() => ({
        post: mock(() => {}),
      }));

      const mockApi: Partial<LocalRestApiPublicApi> = {
        addRoute: mockAddRoute,
      };

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify individual endpoint logs
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Registered endpoint: POST /search/smart",
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        "Registered endpoint: POST /templates/execute",
      );

      // Verify final success log
      expect(mockLogger.info).toHaveBeenCalledWith(
        "MCP Tools Plugin loaded successfully",
      );

      // Verify the order of logs
      const infoCalls = mockLogger.info.mock.calls;
      expect(infoCalls[0][0]).toBe("Registered endpoint: POST /search/smart");
      expect(infoCalls[1][0]).toBe(
        "Registered endpoint: POST /templates/execute",
      );
      expect(infoCalls[2][0]).toBe("MCP Tools Plugin loaded successfully");
    });
  });

  describe("Notice display behavior", () => {
    test("shows persistent notice (duration 0) for missing API", async () => {
      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: false,
        api: undefined,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify notice has duration 0 (persistent)
      expect(mockNotice).toHaveBeenCalledWith(expect.any(String), 0);
    });

    test("shows persistent notice (duration 0) for outdated version", async () => {
      const mockApi: Partial<LocalRestApiPublicApi> = {};

      const dependency: Dependencies["obsidian-local-rest-api"] = {
        id: "obsidian-local-rest-api",
        name: "Local REST API",
        required: true,
        installed: true,
        api: mockApi as LocalRestApiPublicApi,
      };

      mockLoadLocalRestAPI.mockImplementation(() => of(dependency));

      const plugin = new McpToolsPlugin();
      await plugin.onload();

      // Allow async operations to complete
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify notice has duration 0 (persistent)
      expect(mockNotice).toHaveBeenCalledWith(expect.any(String), 0);
    });

    test("includes plugin name in all error messages", async () => {
      const testCases = [
        // Missing API
        {
          dependency: {
            id: "obsidian-local-rest-api" as const,
            name: "Local REST API",
            required: true,
            installed: false,
            api: undefined,
          },
          expectedMessage: "MCP Tools Test: Local REST API plugin is required",
        },
        // Outdated version
        {
          dependency: {
            id: "obsidian-local-rest-api" as const,
            name: "Local REST API",
            required: true,
            installed: true,
            api: {} as LocalRestApiPublicApi,
          },
          expectedMessage: "MCP Tools Test: Local REST API plugin version is outdated",
        },
      ];

      for (const testCase of testCases) {
        mockNotice.mockClear();
        mockLoadLocalRestAPI.mockImplementation(() => of(testCase.dependency));

        const plugin = new McpToolsPlugin();
        await plugin.onload();

        // Allow async operations to complete
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify plugin name is in the message
        expect(mockNotice).toHaveBeenCalledWith(
          expect.stringContaining(testCase.expectedMessage),
          0,
        );
      }
    });
  });
});
