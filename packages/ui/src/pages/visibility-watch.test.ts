import { afterEach, expect, test } from "bun:test";
import { watchVisibility } from "./visibility-watch";

const native = globalThis.IntersectionObserver;
let report: (entries: { isIntersecting: boolean }[]) => void = () => undefined;
const observed: Element[] = [];
let disconnected = 0;

class FakeObserver {
  constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
    report = callback;
  }
  observe(element: Element) {
    observed.push(element);
  }
  disconnect() {
    disconnected += 1;
  }
}

const hide = (state: "hidden" | "visible") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};

afterEach(() => {
  Reflect.set(globalThis, "IntersectionObserver", native);
  Reflect.deleteProperty(document, "visibilityState");
  observed.length = 0;
  disconnected = 0;
});

test("a widget is visible only while the tab is shown and the card is on screen", () => {
  Reflect.set(globalThis, "IntersectionObserver", FakeObserver);
  const card = document.createElement("div");
  const seen: boolean[] = [];
  const stop = watchVisibility(card, (v) => seen.push(v));
  expect(observed).toEqual([card]);
  report([{ isIntersecting: false }]);
  report([{ isIntersecting: true }]);
  hide("hidden");
  hide("visible");
  stop();
  hide("hidden");
  expect(seen).toEqual([true, false, true, false, true]);
  expect(disconnected).toBe(1);
});

test("without an element only the tab counts", () => {
  Reflect.set(globalThis, "IntersectionObserver", FakeObserver);
  const seen: boolean[] = [];
  const stop = watchVisibility(null, (v) => seen.push(v));
  hide("hidden");
  stop();
  expect(observed).toEqual([]);
  expect(seen).toEqual([true, false]);
});
