import { expect, test } from "bun:test";
import { KeyboardSensor } from "@dnd-kit/core";
import { renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { HoldTouchSensor } from "./hold-touch-sensor";
import { NonTouchPointerSensor, useDragSensors } from "./use-drag-sensors";

const pointerDown = (pointerType: string) =>
  ({
    nativeEvent: new PointerEvent("pointerdown", { pointerType, isPrimary: true, button: 0 }),
  }) as ReactPointerEvent;

const activate = (pointerType: string) =>
  NonTouchPointerSensor.activators.map((a) =>
    a.handler(pointerDown(pointerType), { activationConstraint: { distance: 6 } }),
  );

test("a finger never starts the pointer drag, a mouse or a pen still does", () => {
  expect(activate("touch")).toEqual([false]);
  expect(activate("mouse")).toEqual([true]);
  expect(activate("pen")).toEqual([true]);
});

test("a finger drags when it moves after a 200 ms hold and gives way to the menu at 500 ms, the mouse after 6 px", () => {
  const steps = () => undefined;
  const { result } = renderHook(() => useDragSensors(steps));
  const [pointer, touch, keyboard] = result.current;
  expect(pointer?.sensor).toBe(NonTouchPointerSensor);
  expect(pointer?.options).toEqual({ activationConstraint: { distance: 6 } });
  expect(Object.is(touch?.sensor, HoldTouchSensor)).toBe(true);
  expect(touch?.options).toEqual({ hold: 200, tolerance: 8, giveUpAfter: 500 });
  expect(keyboard?.sensor).toBe(KeyboardSensor);
  expect(keyboard?.options).toEqual({ coordinateGetter: steps });
});
