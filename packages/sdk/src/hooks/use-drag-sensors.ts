import {
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

const isTouch = (event: Event): boolean => "pointerType" in event && event.pointerType === "touch";

export class NonTouchPointerSensor extends PointerSensor {
  static override activators = PointerSensor.activators.map((activator) => ({
    ...activator,
    handler: (...args: Parameters<typeof activator.handler>) =>
      !isTouch(args[0].nativeEvent) && activator.handler(...args),
  }));
}

export function useDragSensors(coordinateGetter: KeyboardCoordinateGetter) {
  return useSensors(
    useSensor(NonTouchPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
}
