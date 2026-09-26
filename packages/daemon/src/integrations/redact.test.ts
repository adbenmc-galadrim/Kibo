import { describe, expect, test } from "bun:test";
import { createRedactor, installConsoleRedaction } from "./redact";

describe("redactor", () => {
  test("replaces every occurrence, longest secret first, ignores short values", () => {
    const r = createRedactor();
    r.add("abcdefgh12");
    r.add("abcdefgh1234");
    r.add("short");
    expect(r.redact("x abcdefgh1234 y abcdefgh12 z short")).toBe("x *** y *** z short");
  });

  test("console methods are redacted and restorable", () => {
    const lines: string[] = [];
    const target = {
      log: (...a: unknown[]) => lines.push(a.join(" ")),
      info: (...a: unknown[]) => lines.push(a.join(" ")),
      warn: (...a: unknown[]) => lines.push(a.join(" ")),
      error: (...a: unknown[]) => lines.push(a.join(" ")),
      debug: (...a: unknown[]) => lines.push(a.join(" ")),
    };
    const r = createRedactor();
    r.add("ghp_TESTSECRET0123456789abcdefghijklmn");
    const restore = installConsoleRedaction(r, target);
    target.error(
      "token ghp_TESTSECRET0123456789abcdefghijklmn",
      new Error("bad ghp_TESTSECRET0123456789abcdefghijklmn"),
    );
    target.log({ auth: "Bearer ghp_TESTSECRET0123456789abcdefghijklmn" });
    restore();
    target.log("ghp_TESTSECRET0123456789abcdefghijklmn");
    expect(lines[0]).not.toContain("TESTSECRET");
    expect(lines[0]).toContain("Error: bad ***");
    expect(lines[1]).toBe('{"auth":"Bearer ***"}');
    expect(lines[2]).toContain("TESTSECRET");
  });
});

test("aggregated errors and causes are rendered and redacted", () => {
  const lines: string[] = [];
  const push = (...a: unknown[]) => lines.push(a.join(" "));
  const target = { log: push, info: push, warn: push, error: push, debug: push };
  const r = createRedactor();
  r.add("s3cret-value-123");
  installConsoleRedaction(r, target);
  const failure = new AggregateError(
    [
      new Error("first s3cret-value-123"),
      new Error("restore failed", { cause: new Error("disk s3cret-value-123") }),
    ],
    "rollback failed",
  );
  target.error(failure);
  expect(lines[0]).toContain("first ***");
  expect(lines[0]).toContain("restore failed");
  expect(lines[0]).toContain("disk ***");
  expect(lines[0]).not.toContain("s3cret");
});
