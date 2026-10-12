import { expect, test } from "bun:test";
import { DEFAULT_DUPLICATION_SETTINGS } from "@kibo/schema";
import { screenFor } from "./run-ports";

test("the screen applies the ignore globs of the project, the defaults and the secrets", () => {
  const screen = screenFor((projectId) =>
    projectId === "P"
      ? { ...DEFAULT_DUPLICATION_SETTINGS, ignore: ["private/**"] }
      : DEFAULT_DUPLICATION_SETTINGS,
  );
  expect(screen("P")("private/key.ts")).toBe("ignored");
  expect(screen("Q")("private/key.ts")).toBeNull();
  expect(screen("Q")("node_modules/x.js")).toBe("ignored");
  expect(screen("Q")(".env")).toBe("secret");
  expect(screen("P")("src/lib/format.ts")).toBeNull();
});
