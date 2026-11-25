import type { SensorInstance, SensorProps } from "@dnd-kit/core";
import type { TouchEvent as ReactTouchEvent } from "react";

export type HoldTouchOptions = { hold: number; tolerance: number; giveUpAfter: number };
type Point = { x: number; y: number };

const pointOf = (event: Event): Point | null => {
  if (typeof TouchEvent === "undefined" || !(event instanceof TouchEvent)) return null;
  const touch = event.touches[0] ?? event.changedTouches[0];
  return touch ? { x: touch.clientX, y: touch.clientY } : null;
};

const stopPropagation = (event: Event) => event.stopPropagation();

export class HoldTouchSensor implements SensorInstance {
  autoScrollEnabled = true;
  private readonly origin: Point;
  private readonly target: EventTarget;
  private readonly timers: ReturnType<typeof setTimeout>[];
  private held = false;
  private started = false;

  static activators = [
    {
      eventName: "onTouchStart" as const,
      handler: ({ nativeEvent }: ReactTouchEvent) => nativeEvent.touches.length <= 1,
    },
  ];

  static setup() {
    const noop = () => undefined;
    window.addEventListener("touchmove", noop, { passive: false });
    return () => window.removeEventListener("touchmove", noop);
  }

  constructor(private readonly props: SensorProps<HoldTouchOptions>) {
    const { event, options } = props;
    this.origin = pointOf(event) ?? { x: 0, y: 0 };
    this.target = event.target ?? window;
    this.target.addEventListener("touchmove", this.move, { passive: false });
    this.target.addEventListener("touchend", this.end);
    this.target.addEventListener("touchcancel", this.cancel);
    this.timers = [
      setTimeout(() => {
        this.held = true;
      }, options.hold),
      setTimeout(() => {
        if (!this.started) this.cancel();
      }, options.giveUpAfter),
    ];
  }

  private readonly move = (event: Event) => {
    const point = pointOf(event);
    if (point === null) return;
    if (this.started) {
      if (event.cancelable) event.preventDefault();
      this.props.onMove(point);
      return;
    }
    const far = Math.hypot(point.x - this.origin.x, point.y - this.origin.y) > this.props.options.tolerance;
    if (!this.held) {
      if (far) this.cancel();
      return;
    }
    if (event.cancelable) event.preventDefault();
    if (!far) return;
    this.started = true;
    document.addEventListener("click", stopPropagation, { capture: true });
    this.props.onStart(this.origin);
    this.props.onMove(point);
  };

  private readonly end = () => {
    this.detach();
    if (!this.started) this.props.onAbort(this.props.active);
    this.props.onEnd();
  };

  private readonly cancel = () => {
    this.detach();
    if (!this.started) this.props.onAbort(this.props.active);
    this.props.onCancel();
  };

  private detach() {
    for (const timer of this.timers) clearTimeout(timer);
    this.target.removeEventListener("touchmove", this.move);
    this.target.removeEventListener("touchend", this.end);
    this.target.removeEventListener("touchcancel", this.cancel);
    setTimeout(() => document.removeEventListener("click", stopPropagation, { capture: true }), 50);
  }
}
