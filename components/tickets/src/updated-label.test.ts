import { expect, test } from "bun:test";
import { updatedLabel } from "./updated-label";

const NOW = new Date(2026, 9, 16, 14, 52).getTime();
const at = (day: number, hour: number, minute = 0) => new Date(2026, 9, day, hour, minute).getTime();

test("minutes then hours the same day, then hier, the weekday within a week, the date beyond", () => {
  expect(updatedLabel(NOW - 20_000, NOW)).toBe("à l'instant");
  expect(updatedLabel(at(16, 14, 43), NOW)).toBe("il y a 9 min");
  expect(updatedLabel(at(16, 13, 52), NOW)).toBe("il y a 1 h");
  expect(updatedLabel(at(16, 0, 10), NOW)).toBe("il y a 14 h");
  expect(updatedLabel(at(15, 23, 50), NOW)).toBe("hier");
  expect(updatedLabel(at(14, 9), NOW)).toBe("mer.");
  expect(updatedLabel(at(12, 9), NOW)).toBe("lun.");
  expect(updatedLabel(at(9, 9), NOW)).toBe("9 oct.");
});

test("a date in the future reads as now", () => {
  expect(updatedLabel(NOW + 60_000, NOW)).toBe("à l'instant");
});
