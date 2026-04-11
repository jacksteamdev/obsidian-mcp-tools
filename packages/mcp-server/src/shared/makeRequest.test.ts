import { describe, expect, test } from "bun:test";
import { parsePort, resolvePortFromArgs } from "./makeRequest";

describe("parsePort", () => {
  test("parses a valid port string", () => {
    expect(parsePort("9000")).toBe(9000);
  });

  test("parses the lowest valid port", () => {
    expect(parsePort("1")).toBe(1);
  });

  test("parses the highest valid port", () => {
    expect(parsePort("65535")).toBe(65535);
  });

  test("rejects port zero", () => {
    expect(parsePort("0")).toBeUndefined();
  });

  test("rejects ports above the TCP range", () => {
    expect(parsePort("65536")).toBeUndefined();
  });

  test("rejects non-numeric input", () => {
    expect(parsePort("abc")).toBeUndefined();
  });

  test("rejects mixed alphanumeric input", () => {
    expect(parsePort("9000abc")).toBeUndefined();
  });

  test("rejects negative numbers", () => {
    // The regex ^\d+$ excludes the minus sign, so negatives never reach
    // the numeric range check.
    expect(parsePort("-1")).toBeUndefined();
  });

  test("rejects empty string", () => {
    expect(parsePort("")).toBeUndefined();
  });

  test("rejects undefined", () => {
    expect(parsePort(undefined)).toBeUndefined();
  });

  test("rejects whitespace-only input", () => {
    expect(parsePort("  ")).toBeUndefined();
  });
});

describe("resolvePortFromArgs", () => {
  // Minimal argv prefix that mirrors what Bun/Node pass in production.
  // resolvePortFromArgs ignores argv[0] and argv[1] naturally because
  // neither match `--port` patterns, so we do not need to splice them.
  const prefix = ["/usr/local/bin/bun", "/path/to/index.ts"];

  test("returns undefined for empty argv", () => {
    expect(resolvePortFromArgs([])).toBeUndefined();
  });

  test("returns undefined when argv has no port flag", () => {
    expect(resolvePortFromArgs([...prefix, "--verbose"])).toBeUndefined();
  });

  test("parses --port with a separate value argument", () => {
    expect(resolvePortFromArgs([...prefix, "--port", "9000"])).toBe(9000);
  });

  test("parses --port=value equals form", () => {
    expect(resolvePortFromArgs([...prefix, "--port=9000"])).toBe(9000);
  });

  test("returns undefined when --port value is missing", () => {
    expect(resolvePortFromArgs([...prefix, "--port"])).toBeUndefined();
  });

  test("returns undefined when --port value is invalid", () => {
    expect(resolvePortFromArgs([...prefix, "--port", "abc"])).toBeUndefined();
  });

  test("returns undefined when --port=value value is invalid", () => {
    expect(resolvePortFromArgs([...prefix, "--port=abc"])).toBeUndefined();
  });

  test("equals form takes precedence when both forms appear", () => {
    // Given --port=1111 and a later --port 2222, the equals form wins
    // because .find() stops at the first match. This is a documented
    // invariant of the precedence rule, not an accident.
    const out = resolvePortFromArgs([
      ...prefix,
      "--port=1111",
      "--port",
      "2222",
    ]);
    expect(out).toBe(1111);
  });

  test("ignores unrelated arguments that contain 'port'", () => {
    // `--port-info` must not match the strict `--port` / `--port=` forms.
    expect(
      resolvePortFromArgs([...prefix, "--port-info", "9000"]),
    ).toBeUndefined();
  });
});
