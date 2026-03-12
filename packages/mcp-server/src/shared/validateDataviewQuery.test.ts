import { describe, expect, it } from "bun:test";
import { validateDataviewQuery } from "./validateDataviewQuery";

describe("validateDataviewQuery", () => {
  it("accepts normal DQL queries", () => {
    expect(() =>
      validateDataviewQuery('TABLE file.name FROM "notes"'),
    ).not.toThrow();
    expect(() =>
      validateDataviewQuery('LIST WHERE file.tags CONTAINS "#daily"'),
    ).not.toThrow();
    expect(() => validateDataviewQuery("TASK WHERE !completed")).not.toThrow();
  });

  it("rejects queries containing dataviewjs (case-insensitive)", () => {
    expect(() =>
      validateDataviewQuery("dataviewjs dv.pages()"),
    ).toThrow(/dataviewjs/i);
    expect(() =>
      validateDataviewQuery("DATAVIEWJS dv.pages()"),
    ).toThrow(/dataviewjs/i);
    expect(() =>
      validateDataviewQuery("DataviewJS dv.pages()"),
    ).toThrow(/dataviewjs/i);
    expect(() =>
      validateDataviewQuery('some query with dataviewjs hidden'),
    ).toThrow(/dataviewjs/i);
  });

  it("rejects queries exceeding max length", () => {
    const longQuery = "a".repeat(10001);
    expect(() => validateDataviewQuery(longQuery)).toThrow(/too long/i);
  });

  it("accepts queries at exactly the max length", () => {
    const maxQuery = "a".repeat(10000);
    expect(() => validateDataviewQuery(maxQuery)).not.toThrow();
  });
});
