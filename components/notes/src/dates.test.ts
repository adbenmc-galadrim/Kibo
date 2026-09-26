import { expect, test } from "bun:test";
import { noteDate } from "./dates";

test("today, yesterday, then day/month", () => {
  const now = new Date(2026, 8, 26, 15, 0).getTime();
  expect(noteDate(new Date(2026, 8, 26, 1, 0).getTime(), now)).toBe("aujourd'hui");
  expect(noteDate(new Date(2026, 8, 25, 23, 0).getTime(), now)).toBe("hier");
  expect(noteDate(new Date(2026, 8, 22, 9, 0).getTime(), now)).toBe("22/09");
  expect(noteDate(new Date(2025, 11, 3, 9, 0).getTime(), now)).toBe("03/12");
});
