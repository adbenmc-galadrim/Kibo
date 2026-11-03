import { afterEach, beforeEach, expect, test } from "bun:test";
import type { SensorProps } from "@dnd-kit/core";
import { HoldTouchSensor, type HoldTouchOptions } from "./hold-touch-sensor";

const OPTIONS: HoldTouchOptions = { hold: 30, tolerance: 8, giveUpAfter: 80 };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

let card: HTMLElement;
let calls: string[];

beforeEach(() => {
  card = document.createElement("div");
  document.body.append(card);
  calls = [];
});
afterEach(() => card.remove());

const touch = (type: string, x: number, y: number) => {
  const point = new Touch({ identifier: 1, target: card, clientX: x, clientY: y });
  const list = type === "touchend" ? [] : [point];
  return new TouchEvent(type, { touches: list, changedTouches: [point], bubbles: true, cancelable: true });
};

function start(): HoldTouchSensor {
  const props = {
    active: "card",
    event: touch("touchstart", 10, 10),
    options: OPTIONS,
    onStart: () => calls.push("start"),
    onMove: (p: { x: number; y: number }) => calls.push(`move ${p.x}`),
    onEnd: () => calls.push("end"),
    onCancel: () => calls.push("cancel"),
    onAbort: () => calls.push("abort"),
    onPending: () => undefined,
  } as unknown as SensorProps<HoldTouchOptions>;
  Object.defineProperty(props.event, "target", { value: card });
  return new HoldTouchSensor(props);
}

test("a finger that moves before the hold scrolls: the drag is abandoned", () => {
  start();
  card.dispatchEvent(touch("touchmove", 40, 10));
  expect(calls).toEqual(["abort", "cancel"]);
});

test("a finger held then moved starts the drag from where it was pressed", async () => {
  start();
  await wait(45);
  card.dispatchEvent(touch("touchmove", 12, 10));
  expect(calls).toEqual([]);
  card.dispatchEvent(touch("touchmove", 40, 10));
  card.dispatchEvent(touch("touchend", 40, 10));
  expect(calls).toEqual(["start", "move 40", "end"]);
});

test("a finger that stays still past the menu hold never drags: the long press belongs to the menu", async () => {
  start();
  await wait(110);
  expect(calls).toEqual(["abort", "cancel"]);
  card.dispatchEvent(touch("touchmove", 60, 10));
  expect(calls).toEqual(["abort", "cancel"]);
});
