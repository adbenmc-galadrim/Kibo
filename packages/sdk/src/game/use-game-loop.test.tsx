import { afterEach, beforeEach, expect, test } from "bun:test";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { createMockSdk, type MockSdk } from "../mock";
import { SdkProvider } from "../react";
import { NO_PAD } from "./gamepad";
import { useGameLoop, useGamepad, useKeys } from "./use-game-loop";

let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;
const realRaf = globalThis.requestAnimationFrame;
const realCancel = globalThis.cancelAnimationFrame;

beforeEach(() => {
  queue = new Map();
  globalThis.requestAnimationFrame = (cb) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };
});

afterEach(() => {
  cleanup();
  globalThis.requestAnimationFrame = realRaf;
  globalThis.cancelAnimationFrame = realCancel;
});

const flush = (now: number) =>
  act(() => {
    const pending = [...queue.values()];
    queue.clear();
    for (const cb of pending) cb(now);
  });

const mockSdk = (capabilities: ("gamepad" | "fullscreen")[] = ["gamepad"]) =>
  createMockSdk(
    { id: "game", version: "0.1.0", kind: "widget", title: "Jeu", reads: [], writes: [], capabilities },
    { visible: true },
  );

function Game({ step, probe }: { step: (dt: number) => void; probe: (p: Probe) => void }) {
  const { paused } = useGameLoop(step);
  const keys = useKeys();
  const pad = useGamepad();
  probe({ paused, keys, pad });
  return <input aria-label="nom" />;
}
type Probe = { paused: boolean; keys: ReturnType<typeof useKeys>; pad: ReturnType<typeof useGamepad> };

function mount(m: MockSdk) {
  const steps: number[] = [];
  const seen: Probe[] = [];
  const view = render(
    <SdkProvider sdk={m.sdk}>
      <Game step={(dt) => steps.push(dt)} probe={(p) => seen.push(p)} />
    </SdkProvider>,
  );
  const probe = (): Probe => {
    const last = seen.at(-1);
    if (!last) throw new Error("not rendered");
    return last;
  };
  return { steps, probe, view };
}

test("the loop steps at a fixed rate and pauses when the instance is hidden", () => {
  const m = mockSdk();
  const { steps, probe } = mount(m);
  expect(probe().paused).toBe(false);
  flush(1000);
  expect(steps).toEqual([]);
  flush(1020);
  expect(steps).toEqual([1 / 60]);
  act(() => m.setVisible(false));
  expect(probe().paused).toBe(true);
  flush(1040);
  flush(1080);
  expect(steps).toEqual([1 / 60]);
  act(() => m.setVisible(true));
  expect(probe().paused).toBe(false);
  flush(2000);
  expect(steps).toEqual([1 / 60]);
});

test("the loop stays paused while the caller says it is not running", () => {
  const m = mockSdk();
  const steps: number[] = [];
  const paused: boolean[] = [];
  function Idle() {
    paused.push(useGameLoop((dt) => steps.push(dt), { running: false }).paused);
    return null;
  }
  render(
    <SdkProvider sdk={m.sdk}>
      <Idle />
    </SdkProvider>,
  );
  flush(1000);
  flush(1100);
  expect(paused.at(-1)).toBe(true);
  expect(steps).toEqual([]);
  expect(queue.size).toBe(0);
});

test("game keys are tracked and keep the page from scrolling, except in a field", () => {
  const m = mockSdk();
  const { probe, view } = mount(m);
  const down = new KeyboardEvent("keydown", { code: "ArrowLeft", key: "ArrowLeft", cancelable: true });
  act(() => {
    window.dispatchEvent(down);
  });
  expect(probe().keys.isDown("ArrowLeft")).toBe(true);
  expect(down.defaultPrevented).toBe(true);
  fireEvent.keyUp(window, { code: "ArrowLeft" });
  expect(probe().keys.isDown("ArrowLeft")).toBe(false);
  const field = view.getByLabelText("nom");
  const typed = new KeyboardEvent("keydown", { code: "Space", key: " ", cancelable: true, bubbles: true });
  act(() => {
    field.dispatchEvent(typed);
  });
  expect(typed.defaultPrevented).toBe(false);
  expect(probe().keys.isDown("Space")).toBe(true);
  fireEvent.blur(window);
  expect(probe().keys.isDown("Space")).toBe(false);
});

test("the gamepad needs its capability and reads nothing without a pad", () => {
  const m = mockSdk();
  const { probe } = mount(m);
  flush(1000);
  expect(probe().pad).toBe(NO_PAD);
  expect(m.used).toContain("cap:gamepad");
});

test("the gamepad refuses a component that does not declare it", () => {
  const m = mockSdk(["fullscreen"]);
  const original = console.error;
  console.error = () => {};
  try {
    expect(() => mount(m)).toThrow("PERMISSION_DENIED");
  } finally {
    console.error = original;
  }
});
