import { expect, test } from "bun:test";
import fc from "fast-check";
import { addDays, dateOf, dayNumber, isoWeekday, nextMonday } from "./iso-date";

const FIRST = dayNumber("1990-01-01");
const LAST = dayNumber("2100-12-31");
const isoDate = fc.integer({ min: FIRST, max: LAST }).map(dateOf);
const shift = fc.integer({ min: -400, max: 400 });

test("a date survives its day number", () => {
  fc.assert(fc.property(isoDate, (d) => dateOf(dayNumber(d)) === d));
});

test("adding days composes", () => {
  fc.assert(
    fc.property(isoDate, shift, shift, (d, a, b) => {
      expect(addDays(addDays(d, a), b)).toBe(addDays(d, a + b));
    }),
  );
});

test("the next Monday is a Monday one to seven days later", () => {
  fc.assert(
    fc.property(isoDate, (d) => {
      const monday = nextMonday(d);
      const gap = dayNumber(monday) - dayNumber(d);
      expect(monday > d).toBe(true);
      expect(isoWeekday(monday)).toBe(1);
      expect(gap >= 1 && gap <= 7).toBe(true);
    }),
  );
});
