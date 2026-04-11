import { describe, expect, test } from "bun:test";
import { resolveHeadingPath } from "./index";

describe("resolveHeadingPath", () => {
  test("returns null for empty content", () => {
    expect(resolveHeadingPath("", "Anything", "::")).toBeNull();
  });

  test("returns null for content without any headings", () => {
    const content = "Just some paragraph text.\nNo headings here at all.";
    expect(resolveHeadingPath(content, "Section", "::")).toBeNull();
  });

  test("returns the H1 name when a top-level heading matches", () => {
    const content = `# Top Level\n\nSome body.`;
    expect(resolveHeadingPath(content, "Top Level", "::")).toBe("Top Level");
  });

  test("resolves a partial H2 leaf name to its full hierarchical path", () => {
    const content = `# Top Level\n\n## Section A\n\nBody.`;
    expect(resolveHeadingPath(content, "Section A", "::")).toBe(
      "Top Level::Section A",
    );
  });

  test("resolves deep nesting across H1/H2/H3", () => {
    const content = `
# Top
## Middle
### Deep
Some body.
    `;
    expect(resolveHeadingPath(content, "Deep", "::")).toBe(
      "Top::Middle::Deep",
    );
  });

  test("returns null when the leaf name does not exist", () => {
    const content = `# Top\n## Section A`;
    expect(resolveHeadingPath(content, "Section B", "::")).toBeNull();
  });

  test("returns the first match when multiple headings share the same name", () => {
    const content = `
# Alpha
## Notes
# Beta
## Notes
    `;
    // The first "Notes" is nested under Alpha; that's what we return.
    expect(resolveHeadingPath(content, "Notes", "::")).toBe("Alpha::Notes");
  });

  test("respects a custom delimiter passed by the caller", () => {
    const content = `# Top\n## Leaf`;
    expect(resolveHeadingPath(content, "Leaf", " > ")).toBe("Top > Leaf");
  });

  test("resets deeper stack slots when returning to a shallower level", () => {
    // After leaving "## Old Section" behind, a subsequent top-level "# New"
    // must not still expose "Old Section" as an ancestor of its children.
    const content = `
# First
## Old Section
# New
## Target
    `;
    expect(resolveHeadingPath(content, "Target", "::")).toBe("New::Target");
  });

  test("ignores paragraph text that resembles a heading mid-line", () => {
    // Only lines that actually start with '#' count as headings. A line like
    // "some text # not a heading" must be skipped by the parser.
    const content = `
Plain paragraph # not a heading
# Real Heading
    `;
    expect(resolveHeadingPath(content, "Real Heading", "::")).toBe(
      "Real Heading",
    );
  });
});
