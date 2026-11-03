import {
  type KeyboardCoordinateGetter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { HoldTouchSensor } from "./hold-touch-sensor";
import { TOUCH_DRAG_HOLD_MS, TOUCH_MENU_HOLD_MS, TOUCH_TOLERANCE_PX } from "./use-touch-hold";

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
    useSensor(HoldTouchSensor, {
      hold: TOUCH_DRAG_HOLD_MS,
      tolerance: TOUCH_TOLERANCE_PX,
      giveUpAfter: TOUCH_MENU_HOLD_MS,
    }),
    useSensor(KeyboardSensor, { coordinateGetter }),
  );
}
