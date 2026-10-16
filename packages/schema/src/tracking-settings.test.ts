import { expect, test } from "bun:test";
import { DEFAULT_OPEN_LIMIT } from "./feature-state";
import { openLimitOf, TrackingSettings } from "./tracking-settings";

test("the open limit is an integer from 1 to 10, the settings are strict", () => {
  expect(TrackingSettings.parse({ openLimit: 3 })).toEqual({ openLimit: 3 });
  expect(TrackingSettings.safeParse({ openLimit: 0 }).success).toBe(false);
  expect(TrackingSettings.safeParse({ openLimit: 11 }).success).toBe(false);
  expect(TrackingSettings.safeParse({ openLimit: 2.5 }).success).toBe(false);
  expect(TrackingSettings.safeParse({}).success).toBe(false);
  expect(TrackingSettings.safeParse({ openLimit: 2, extra: true }).success).toBe(false);
});

test("without settings the open limit is two", () => {
  expect(DEFAULT_OPEN_LIMIT).toBe(2);
  expect(openLimitOf(null)).toBe(2);
  expect(openLimitOf({ openLimit: 4 })).toBe(4);
});
