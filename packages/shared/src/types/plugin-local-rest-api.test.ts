import { describe, expect, test } from "bun:test";
import { type } from "arktype";

/**
 * Tests for Local REST API type schemas
 * Issue #41: Make frontmatter.tags optional in ApiVaultFileResponse
 */
describe("ApiVaultFileResponse schema", () => {
  // Replicate the schema from plugin-local-rest-api.ts
  const ApiVaultFileResponse = type({
    frontmatter: {
      tags: "string[]?",
      description: "string?",
    },
    content: "string",
    path: "string",
    stat: {
      ctime: "number",
      mtime: "number",
      size: "number",
    },
  });

  test("accepts vault file response with tags", () => {
    const response = {
      frontmatter: {
        tags: ["tag1", "tag2"],
        description: "A test file",
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.frontmatter.tags).toEqual(["tag1", "tag2"]);
      expect(validated.frontmatter.description).toBe("A test file");
    }
  });

  test("accepts vault file response without tags", () => {
    const response = {
      frontmatter: {
        description: "A test file",
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.frontmatter.tags).toBeUndefined();
      expect(validated.frontmatter.description).toBe("A test file");
    }
  });

  test("accepts vault file response without description", () => {
    const response = {
      frontmatter: {
        tags: ["tag1"],
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.frontmatter.tags).toEqual(["tag1"]);
      expect(validated.frontmatter.description).toBeUndefined();
    }
  });

  test("accepts vault file response with empty frontmatter", () => {
    const response = {
      frontmatter: {},
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.frontmatter.tags).toBeUndefined();
      expect(validated.frontmatter.description).toBeUndefined();
    }
  });

  test("accepts vault file response with empty tags array", () => {
    const response = {
      frontmatter: {
        tags: [],
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);

    if (!(validated instanceof type.errors)) {
      expect(validated.frontmatter.tags).toEqual([]);
    }
  });

  test("rejects vault file response with tags as non-array", () => {
    const response = {
      frontmatter: {
        tags: "not-an-array",
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(true);
  });

  test("rejects vault file response with tags containing non-strings", () => {
    const response = {
      frontmatter: {
        tags: [123, 456],
      },
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(true);
  });

  test("requires content field", () => {
    const response = {
      frontmatter: {},
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(true);
  });

  test("requires path field", () => {
    const response = {
      frontmatter: {},
      content: "# Test Content",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        size: 100,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(true);
  });

  test("requires stat field with correct structure", () => {
    const response = {
      frontmatter: {},
      content: "# Test Content",
      path: "/vault/test.md",
      stat: {
        ctime: 1234567890,
        mtime: 1234567890,
        // missing size
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(true);
  });

  test("accepts vault file with typical Obsidian frontmatter", () => {
    const response = {
      frontmatter: {
        tags: ["obsidian", "notes", "productivity"],
        description: "My daily note from today",
      },
      content: "# Daily Note\n\n## Tasks\n- [ ] Task 1",
      path: "/vault/Daily/2024-01-15.md",
      stat: {
        ctime: 1705334400000,
        mtime: 1705420800000,
        size: 1024,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);
  });

  test("accepts vault file from Templater plugin without tags", () => {
    // Templater templates may not have tags in frontmatter
    const response = {
      frontmatter: {
        description: "Template for new notes",
      },
      content: "<% tp.date.now() %>",
      path: "/vault/Templates/note-template.md",
      stat: {
        ctime: 1705334400000,
        mtime: 1705420800000,
        size: 512,
      },
    };

    const validated = ApiVaultFileResponse(response);
    expect(validated instanceof type.errors).toBe(false);
  });
});
