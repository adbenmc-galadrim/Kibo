import { expect, test } from "bun:test";
import { relativeTime } from "./relative-time";

test("relative times are short and French", () => {
  const now = 1_000_000_000_000;
  expect(relativeTime(now - 20_000, now)).toBe("à l'instant");
  expect(relativeTime(now - 8 * 60_000, now)).toBe("il y a 8 min");
  expect(relativeTime(now - 3 * 3_600_000, now)).toBe("il y a 3 h");
  expect(relativeTime(now - 2 * 86_400_000, now)).toBe("il y a 2 j");
});
