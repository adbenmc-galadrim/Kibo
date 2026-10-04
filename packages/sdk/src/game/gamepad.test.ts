import { expect, test } from "bun:test";
import { readGamepad, samePad } from "./gamepad";

test("gamepad state applies a deadzone and copies buttons", () => {
  const pad = {
    connected: true,
    axes: [0.05, -0.8],
    buttons: [{ pressed: true }, { pressed: false }],
  } as unknown as Gamepad;
  expect(readGamepad(pad)).toEqual({ connected: true, axes: [0, -0.8], buttons: [true, false] });
  expect(readGamepad(null)).toEqual({ connected: false, axes: [], buttons: [] });
});

test("two pad states are the same when every value matches", () => {
  const a = { connected: true, axes: [0, 1], buttons: [true] };
  expect(samePad(a, { connected: true, axes: [0, 1], buttons: [true] })).toBe(true);
  expect(samePad(a, { ...a, axes: [0, -1] })).toBe(false);
  expect(samePad(a, { ...a, buttons: [false] })).toBe(false);
  expect(samePad(a, { ...a, connected: false })).toBe(false);
});
