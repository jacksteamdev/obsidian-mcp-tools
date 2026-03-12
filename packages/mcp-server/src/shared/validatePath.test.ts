import { describe, expect, it } from "bun:test";
import { validateVaultPath } from "./validatePath";

describe("validateVaultPath", () => {
  it("accepts normal vault paths", () => {
    expect(() => validateVaultPath("notes/daily.md")).not.toThrow();
    expect(() => validateVaultPath("Templates/template.md")).not.toThrow();
    expect(() => validateVaultPath("folder/subfolder/file.md")).not.toThrow();
    expect(() => validateVaultPath("my notes.md")).not.toThrow();
  });

  it("rejects paths containing '..'", () => {
    expect(() => validateVaultPath("../secret")).toThrow("path traversal");
    expect(() => validateVaultPath("foo/../bar")).toThrow("path traversal");
    expect(() => validateVaultPath("..")).toThrow("path traversal");
    expect(() => validateVaultPath("foo/../../etc/passwd")).toThrow(
      "path traversal",
    );
  });

  it("rejects absolute paths", () => {
    expect(() => validateVaultPath("/etc/passwd")).toThrow("Absolute paths");
    expect(() => validateVaultPath("/foo/bar")).toThrow("Absolute paths");
  });

  it("rejects paths with null bytes", () => {
    expect(() => validateVaultPath("foo\0bar")).toThrow("null bytes");
  });

  it("accepts filenames containing '..' as a substring (not a path segment)", () => {
    expect(() => validateVaultPath("my..note.md")).not.toThrow();
    expect(() => validateVaultPath("version 2..0.md")).not.toThrow();
  });

  it("returns the path unchanged for valid inputs", () => {
    expect(validateVaultPath("notes/daily.md")).toBe("notes/daily.md");
    expect(validateVaultPath("Templates/template.md")).toBe(
      "Templates/template.md",
    );
  });
});
