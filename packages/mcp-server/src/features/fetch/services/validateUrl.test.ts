import { describe, expect, it } from "bun:test";
import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
  // Valid URLs
  it("should accept https://example.com", async () => {
    await expect(validateUrl("https://example.com")).resolves.toBeUndefined();
  });

  it("should accept http://example.com", async () => {
    await expect(validateUrl("http://example.com")).resolves.toBeUndefined();
  });

  // Invalid schemes
  it("should reject file:///etc/passwd", async () => {
    await expect(validateUrl("file:///etc/passwd")).rejects.toThrow(
      /scheme/i,
    );
  });

  it("should reject data: URLs", async () => {
    await expect(
      validateUrl("data:text/html,<h1>hello</h1>"),
    ).rejects.toThrow(/scheme/i);
  });

  it("should reject ftp: URLs", async () => {
    await expect(validateUrl("ftp://example.com")).rejects.toThrow(/scheme/i);
  });

  // Invalid URLs
  it("should reject invalid URLs", async () => {
    await expect(validateUrl("not-a-url")).rejects.toThrow();
  });

  it("should reject empty string", async () => {
    await expect(validateUrl("")).rejects.toThrow();
  });

  // Private IP ranges
  it("should reject http://127.0.0.1", async () => {
    await expect(validateUrl("http://127.0.0.1")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  it("should reject http://127.0.0.2", async () => {
    await expect(validateUrl("http://127.0.0.2")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  it("should reject http://10.0.0.1", async () => {
    await expect(validateUrl("http://10.0.0.1")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  it("should reject http://172.16.0.1", async () => {
    await expect(validateUrl("http://172.16.0.1")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  it("should reject http://192.168.1.1", async () => {
    await expect(validateUrl("http://192.168.1.1")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  // Cloud metadata
  it("should reject http://169.254.169.254 (cloud metadata)", async () => {
    await expect(validateUrl("http://169.254.169.254")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  it("should reject http://169.254.0.1 (link-local)", async () => {
    await expect(validateUrl("http://169.254.0.1")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  // IPv6 private
  it("should reject http://[::1]", async () => {
    await expect(validateUrl("http://[::1]")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  // 0.0.0.0
  it("should reject http://0.0.0.0", async () => {
    await expect(validateUrl("http://0.0.0.0")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });

  // localhost
  it("should reject http://localhost", async () => {
    await expect(validateUrl("http://localhost")).rejects.toThrow(
      /private|reserved|blocked/i,
    );
  });
});
