import { expect, test } from "bun:test";
import { KeyboardSensor, TouchSensor } from "@dnd-kit/core";
import { renderHook } from "@testing-library/react";
import type { PointerEvent as ReactPointerEvent } from "react";
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

test("a finger drags after a 200 ms hold within 8 px, the mouse after 6 px, the keyboard by steps", () => {
  const steps = () => undefined;
  const { result } = renderHook(() => useDragSensors(steps));
  const [pointer, touch, keyboard] = result.current;
  expect(pointer?.sensor).toBe(NonTouchPointerSensor);
  expect(pointer?.options).toEqual({ activationConstraint: { distance: 6 } });
  expect(touch?.sensor).toBe(TouchSensor);
  expect(touch?.options).toEqual({ activationConstraint: { delay: 200, tolerance: 8 } });
  expect(keyboard?.sensor).toBe(KeyboardSensor);
  expect(keyboard?.options).toEqual({ coordinateGetter: steps });
});
