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
