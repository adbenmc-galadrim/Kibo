import type { Capability } from "@kibo/schema";

type Win = Window & typeof globalThis;
type Restore = () => void;

const GL_CONTEXTS = new Set(["webgl", "webgl2", "experimental-webgl", "webgpu"]);

function override(target: object, key: string, value: unknown): Restore {
  const previous = Object.getOwnPropertyDescriptor(target, key);
  Object.defineProperty(target, key, { value, writable: false, configurable: true });
  return () => {
    if (previous) Object.defineProperty(target, key, previous);
    else Reflect.deleteProperty(target, key);
  };
}

function guardWebgl(win: Win): Restore {
  const original = win.HTMLCanvasElement.prototype.getContext;
  function guarded(this: HTMLCanvasElement, id: string, ...rest: unknown[]) {
    if (GL_CONTEXTS.has(id)) {
      console.warn("[kibo-sandbox] webgl capability not declared");
      return null;
    }
    return Reflect.apply(original, this, [id, ...rest]);
  }
  return override(win.HTMLCanvasElement.prototype, "getContext", guarded);
}

function guardAudio(win: Win): Restore {
  const refusePlay = () =>
    Promise.reject(new DOMException("audio capability not declared", "NotAllowedError"));
  const restores = [
    override(win, "AudioContext", undefined),
    override(win, "webkitAudioContext", undefined),
    override(win.HTMLMediaElement.prototype, "play", refusePlay),
  ];
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

const guardGamepad = (win: Win): Restore => override(win.navigator, "getGamepads", () => []);

export function installCapabilityGuards(win: Win, capabilities: readonly Capability[]): Restore {
  const restores: Restore[] = [];
  if (!capabilities.includes("webgl")) restores.push(guardWebgl(win));
  if (!capabilities.includes("audio")) restores.push(guardAudio(win));
  if (!capabilities.includes("gamepad")) restores.push(guardGamepad(win));
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}
