import { expect, test } from "bun:test";
import { formatPairingCode, remaining } from "./pairing-code";

test("formats a pairing code as two groups of three", () => {
  expect(formatPairingCode("K7Q4M2")).toBe("K7Q-4M2");
});

test("remaining time is m:ss and never negative", () => {
  expect(remaining(300_000, 1_000)).toBe("4:59");
  expect(remaining(300_000, 299_500)).toBe("0:01");
  expect(remaining(300_000, 400_000)).toBe("0:00");
});
