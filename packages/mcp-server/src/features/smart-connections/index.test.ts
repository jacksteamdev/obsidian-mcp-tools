import { describe, expect, test } from "bun:test";
import { buildSmartSearchRequestOptions } from "./index";

describe("buildSmartSearchRequestOptions — issue #39", () => {
  // Pin the explicit `Content-Type: application/json` header. The plugin-
  // side `/search/smart` endpoint parses `req.body` via Express's
  // `bodyParser.json()`, which only activates for `application/json`
  // requests. `makeRequest`'s default is `text/markdown` (correct for the
  // file-content endpoints), so the smart-search handler must override.
  // Losing the override silently reintroduces "semantic search returns
  // no results" — the original symptom of upstream issue #39.

  test("sets Content-Type: application/json", () => {
    const opts = buildSmartSearchRequestOptions({ query: "test" });
    expect(opts.headers).toEqual({ "Content-Type": "application/json" });
  });

  test("uses POST method", () => {
    const opts = buildSmartSearchRequestOptions({ query: "test" });
    expect(opts.method).toBe("POST");
  });

  test("serializes the body as JSON", () => {
    const body = {
      query: "semantic",
      filter: { folders: ["Public"], limit: 10 },
    };
    const opts = buildSmartSearchRequestOptions(body);
    expect(typeof opts.body).toBe("string");
    expect(JSON.parse(opts.body as string)).toEqual(body);
  });

  test("preserves an empty filter object", () => {
    const body = { query: "x", filter: {} };
    const opts = buildSmartSearchRequestOptions(body);
    expect(JSON.parse(opts.body as string)).toEqual(body);
  });

  test("serializes an unknown-shaped body without throwing", () => {
    // Defensive: the helper takes `unknown` so a future caller passing a
    // shape the tool schema doesn't enforce still round-trips through
    // JSON.stringify rather than crashing.
    const opts = buildSmartSearchRequestOptions({ arbitrary: [1, 2, 3] });
    expect(JSON.parse(opts.body as string)).toEqual({ arbitrary: [1, 2, 3] });
  });
});
