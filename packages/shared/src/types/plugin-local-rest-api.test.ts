import { describe, expect, test } from "bun:test";
import { type } from "arktype";
import {
  ApiStatusResponse,
  ApiVaultFileResponse,
} from "./plugin-local-rest-api";

// A manifest shape the Local REST API root endpoint always echoes back.
// Used as a fixture for ApiStatusResponse tests — keep in sync with the
// ApiPluginManifest schema if that one ever changes.
const manifestFixture = {
  id: "obsidian-local-rest-api",
  name: "Local REST API",
  version: "3.4.3",
  minAppVersion: "0.12.0",
  description: "HTTP REST API for Obsidian",
  author: "Robert Coddington",
  authorUrl: "https://coddingtonbear.net/",
  isDesktopOnly: true,
  dir: ".obsidian/plugins/obsidian-local-rest-api",
};

const baseStatusResponse = {
  status: "OK",
  manifest: manifestFixture,
  versions: { obsidian: "1.11.7", self: "3.4.3" },
  service: "Obsidian Local REST API",
  authenticated: false,
};

describe("ApiStatusResponse — issue #68 (Local REST API v3.4.x compatibility)", () => {
  test("accepts a response without certificateInfo or apiExtensions (unauthenticated)", () => {
    // The Local REST API maintainer confirmed upstream that these fields
    // are emitted ONLY when the caller provides a valid bearer token —
    // the same server responds with a trimmed body to anonymous callers.
    // Requiring them broke every MCP tool call when the startup probe
    // happened before auth was in place. Keeping them optional is the
    // correct shape contract.
    const result = ApiStatusResponse(baseStatusResponse);
    expect(result).toEqual(baseStatusResponse);
  });

  test("accepts a response with both certificateInfo and apiExtensions (authenticated)", () => {
    const authenticated = {
      ...baseStatusResponse,
      authenticated: true,
      certificateInfo: {
        validityDays: 364.77,
        regenerateRecommended: false,
      },
      apiExtensions: [{ ...manifestFixture, id: "mcp-tools" }],
    };
    const result = ApiStatusResponse(authenticated);
    expect(result).toEqual(authenticated);
  });

  test("accepts a response with only certificateInfo (partial presence)", () => {
    // Documents the defensive contract: either optional field may appear
    // independently without the other. Not an observed shape in the wild,
    // but we don't enforce co-presence.
    const result = ApiStatusResponse({
      ...baseStatusResponse,
      certificateInfo: { validityDays: 30, regenerateRecommended: true },
    });
    expect(result).toMatchObject({
      certificateInfo: { validityDays: 30, regenerateRecommended: true },
    });
  });

  test("rejects a response missing a required core field", () => {
    // Sanity check: we've only loosened the two problem fields, not the
    // whole schema. `manifest` is still load-bearing.
    const { manifest: _manifest, ...incomplete } = baseStatusResponse;
    const result = ApiStatusResponse(incomplete);
    expect(result).toBeInstanceOf(type.errors);
  });

  test("rejects a response whose certificateInfo has the wrong shape", () => {
    // Optional-doesn't-mean-any: if the field IS present, it must still
    // conform to the documented shape.
    const result = ApiStatusResponse({
      ...baseStatusResponse,
      certificateInfo: "not an object",
    });
    expect(result).toBeInstanceOf(type.errors);
  });
});

describe("ApiVaultFileResponse — issue #41 (frontmatter.tags optional)", () => {
  const baseFile = {
    content: "# Heading\n\nBody text.",
    path: "Notes/example.md",
    stat: { ctime: 1700000000000, mtime: 1700000000000, size: 42 },
    tags: ["#todo"],
  };

  test("accepts a note with no tags field in frontmatter", () => {
    // Obsidian emits frontmatter.tags only when the note's YAML actually
    // declares a `tags:` key. Templater templates and freshly-created
    // notes commonly lack it, and hard-requiring the field made
    // execute_template / prompt loading fail with a confusing
    // "frontmatter.tags must be an array (was null)" error.
    const result = ApiVaultFileResponse({
      ...baseFile,
      frontmatter: { description: "A plain note" },
    });
    expect(result).toMatchObject({
      frontmatter: { description: "A plain note" },
    });
  });

  test("accepts a note with tags explicitly set to an array in frontmatter", () => {
    const result = ApiVaultFileResponse({
      ...baseFile,
      frontmatter: { tags: ["idea", "writing"] },
    });
    expect(result).toMatchObject({
      frontmatter: { tags: ["idea", "writing"] },
    });
  });

  test("accepts a note with an empty frontmatter object", () => {
    // The workaround previously suggested to users was to add `tags: []`
    // to every template — this test pins the fix so they no longer need
    // to. An entirely empty `---\n---` block must validate.
    const result = ApiVaultFileResponse({
      ...baseFile,
      frontmatter: {},
    });
    expect(result).toMatchObject({ frontmatter: {} });
  });

  test("rejects a note whose frontmatter.tags is present but not an array of strings", () => {
    // If `tags` IS in the frontmatter, it must conform. A string value
    // (as Obsidian sometimes emits for a single-tag case depending on
    // plugin config) is NOT accepted here — that's a separate upstream
    // concern, tracked in the #41 thread's follow-up comments.
    const result = ApiVaultFileResponse({
      ...baseFile,
      frontmatter: { tags: "single-tag-as-string" },
    });
    expect(result).toBeInstanceOf(type.errors);
  });

  test("rejects a note missing the top-level required fields", () => {
    // Sanity check: we've only loosened frontmatter.tags, not the whole
    // schema. Top-level `tags`, `content`, `path`, `stat` remain
    // required.
    const { content: _content, ...incomplete } = baseFile;
    const result = ApiVaultFileResponse({
      ...incomplete,
      frontmatter: {},
    });
    expect(result).toBeInstanceOf(type.errors);
  });
});

