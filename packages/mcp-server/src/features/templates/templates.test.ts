import { describe, expect, it } from "bun:test";
import { validateTemplatePath } from "./validateTemplatePath";

describe("validateTemplatePath", () => {
  // Valid paths
  it("should accept normal template names", () => {
    expect(() => validateTemplatePath("Templates/daily.md")).not.toThrow();
  });

  it("should accept simple filenames", () => {
    expect(() => validateTemplatePath("template.md")).not.toThrow();
  });

  it("should accept nested paths", () => {
    expect(() => validateTemplatePath("folder/subfolder/note.md")).not.toThrow();
  });

  // Path traversal
  it("should reject names containing ..", () => {
    expect(() => validateTemplatePath("../secret")).toThrow(/path traversal/i);
  });

  it("should reject names with .. in the middle", () => {
    expect(() => validateTemplatePath("templates/../../../etc/passwd")).toThrow(
      /path traversal/i,
    );
  });

  it("should reject names starting with ..", () => {
    expect(() => validateTemplatePath("..")).toThrow(/path traversal/i);
  });

  // Null bytes
  it("should reject names with null bytes", () => {
    expect(() => validateTemplatePath("template\0.md")).toThrow();
  });

  // Absolute paths
  it("should reject absolute paths", () => {
    expect(() => validateTemplatePath("/etc/passwd")).toThrow();
  });
});
