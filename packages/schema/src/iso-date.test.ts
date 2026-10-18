import { expect, test } from "bun:test";
import { addDays, dateOf, dayNumber, isoWeekday, nextMonday } from "./iso-date";

test("days are counted from 1970-01-01 in UTC", () => {
  expect(dayNumber("1970-01-01")).toBe(0);
  expect(dayNumber("1970-01-02")).toBe(1);
  expect(dateOf(dayNumber("2026-10-19"))).toBe("2026-10-19");
});

test("adding days crosses months, years and leap days", () => {
  expect(addDays("2026-10-19", 4)).toBe("2026-10-23");
  expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
  expect(addDays("2026-10-19", -1)).toBe("2026-10-18");
});

test("the ISO weekday starts on Monday", () => {
  expect(isoWeekday("2026-10-19")).toBe(1);
  expect(isoWeekday("2026-10-16")).toBe(5);
  expect(isoWeekday("2026-10-18")).toBe(7);
});

test("the next Monday is strictly after the date", () => {
  expect(nextMonday("2026-10-16")).toBe("2026-10-19");
  expect(nextMonday("2026-10-18")).toBe("2026-10-19");
  expect(nextMonday("2026-10-19")).toBe("2026-10-26");
  expect(nextMonday("2026-12-29")).toBe("2027-01-04");
});
