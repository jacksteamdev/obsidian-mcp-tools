import { describe, expect, it } from "bun:test";
import { validateVaultPath } from "$/shared";

describe("validateVaultPath (template context)", () => {
  it("should accept normal template names", () => {
    expect(() => validateVaultPath("Templates/daily.md")).not.toThrow();
  });

  it("should accept simple filenames", () => {
    expect(() => validateVaultPath("template.md")).not.toThrow();
  });

  it("should accept nested paths", () => {
    expect(() => validateVaultPath("folder/subfolder/note.md")).not.toThrow();
  });

  it("should reject names containing ..", () => {
    expect(() => validateVaultPath("../secret")).toThrow(/path traversal/i);
  });

  it("should reject names with .. in the middle", () => {
    expect(() => validateVaultPath("templates/../../../etc/passwd")).toThrow(
      /path traversal/i,
    );
  });

  it("should reject names starting with ..", () => {
    expect(() => validateVaultPath("..")).toThrow(/path traversal/i);
  });

  it("should reject names with null bytes", () => {
    expect(() => validateVaultPath("template\0.md")).toThrow(/null bytes/i);
  });

  it("should reject absolute paths", () => {
    expect(() => validateVaultPath("/etc/passwd")).toThrow(/absolute/i);
  });
});
