import { expect, test } from "bun:test";
import fc from "fast-check";
import { redactPaths } from "./redact-paths";

test("the user home never survives, wherever it appears", () => {
  fc.assert(
    fc.property(fc.array(fc.string(), { maxLength: 6 }), (parts) => {
      const line = parts.join("/Users/adam");
      return !redactPaths(line, "/Users/adam").includes("/Users/adam");
    }),
  );
});

test("other paths are kept and a trailing slash does not matter", () => {
  expect(redactPaths("saved /Users/adam/.kibo/kibo.db and /tmp/x", "/Users/adam/")).toBe(
    "saved ~/.kibo/kibo.db and /tmp/x",
  );
});

test("an empty or root home leaves the text untouched", () => {
  expect(redactPaths("/tmp/x", "")).toBe("/tmp/x");
  expect(redactPaths("/tmp/x", "/")).toBe("/tmp/x");
});
