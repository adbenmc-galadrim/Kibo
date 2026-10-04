import { afterEach, expect, test } from "bun:test";
import { installCapabilityGuards } from "./capability-guards";

const win = window as Window & typeof globalThis;
const gamepads = () => [null];
const restores: Array<() => void> = [];
const install = (capabilities: Parameters<typeof installCapabilityGuards>[1]) =>
  restores.push(installCapabilityGuards(win, capabilities));

afterEach(() => {
  for (const restore of restores.splice(0).reverse()) restore();
  Reflect.deleteProperty(win.navigator, "getGamepads");
});

test("without webgl, gamepad and audio the globals are neutralised", async () => {
  Object.defineProperty(win.navigator, "getGamepads", { value: gamepads, configurable: true });
  const canvas = document.createElement("canvas");
  install([]);
  expect(canvas.getContext("webgl")).toBeNull();
  expect(canvas.getContext("webgl2")).toBeNull();
  expect(canvas.getContext("experimental-webgl")).toBeNull();
  expect(win.navigator.getGamepads()).toEqual([]);
  expect(Reflect.get(win, "AudioContext")).toBeUndefined();
  expect(Reflect.get(win, "webkitAudioContext")).toBeUndefined();
  await expect(document.createElement("audio").play()).rejects.toMatchObject({ name: "NotAllowedError" });
});

test("a guarded canvas still hands out its 2d context", () => {
  const before = win.HTMLCanvasElement.prototype.getContext;
  let asked: unknown[] = [];
  win.HTMLCanvasElement.prototype.getContext = function probe(this: HTMLCanvasElement, ...args: unknown[]) {
    asked = args;
    return null;
  } as typeof before;
  restores.push(() => {
    win.HTMLCanvasElement.prototype.getContext = before;
  });
  install([]);
  document.createElement("canvas").getContext("2d", { alpha: false });
  expect(asked).toEqual(["2d", { alpha: false }]);
});

test("declared capabilities leave the globals alone", () => {
  const getContext = win.HTMLCanvasElement.prototype.getContext;
  const play = win.HTMLMediaElement.prototype.play;
  Object.defineProperty(win.navigator, "getGamepads", { value: gamepads, configurable: true });
  install(["webgl", "gamepad", "audio"]);
  expect(win.HTMLCanvasElement.prototype.getContext).toBe(getContext);
  expect(win.HTMLMediaElement.prototype.play).toBe(play);
  expect(win.navigator.getGamepads).toBe(gamepads);
});

test("restoring puts every global back", () => {
  const getContext = win.HTMLCanvasElement.prototype.getContext;
  const play = win.HTMLMediaElement.prototype.play;
  Object.defineProperty(win.navigator, "getGamepads", { value: gamepads, configurable: true });
  installCapabilityGuards(win, [])();
  expect(win.HTMLCanvasElement.prototype.getContext).toBe(getContext);
  expect(win.HTMLMediaElement.prototype.play).toBe(play);
  expect(win.navigator.getGamepads).toBe(gamepads);
  expect(Object.getOwnPropertyDescriptor(win, "AudioContext")).toBeUndefined();
});
