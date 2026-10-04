import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { isEditableTarget } from "../key-guard";
import { clampDt } from "../lib/frame-time";
import { useSdk, useVisible } from "../react";
import { FIXED_STEP, stepAccumulator } from "./accumulator";
import { NO_PAD, type PadState, readGamepad, samePad } from "./gamepad";
import { GAME_KEYS, type KeyState, keysReducer } from "./keys";

const subscribeDocument = (listener: () => void) => {
  document.addEventListener("visibilitychange", listener);
  return () => document.removeEventListener("visibilitychange", listener);
};
const documentVisible = () => document.visibilityState !== "hidden";

function useDocumentVisible(): boolean {
  return useSyncExternalStore(subscribeDocument, documentVisible, () => true);
}

export function useGameLoop(
  step: (dt: number) => void,
  opts: { running?: boolean } = {},
): { paused: boolean } {
  const visible = useVisible();
  const shown = useDocumentVisible();
  const running = (opts.running ?? true) && visible && shown;
  const latest = useRef(step);
  latest.current = step;
  useEffect(() => {
    if (!running) return;
    let previous: number | null = null;
    let acc = 0;
    let raf = requestAnimationFrame(function tick(now) {
      const { steps, rest } = stepAccumulator(acc, clampDt(previous, now));
      previous = now;
      acc = rest;
      for (let i = 0; i < steps; i++) latest.current(FIXED_STEP);
      raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return { paused: !running };
}

export function useKeys(): { isDown(code: string): boolean } {
  const state = useRef<KeyState>(new Set());
  useEffect(() => {
    const on = (type: "keydown" | "keyup") => (e: KeyboardEvent) => {
      state.current = keysReducer(state.current, { type, code: e.code });
      if (type === "keydown" && GAME_KEYS.includes(e.code) && !isEditableTarget(e.target)) e.preventDefault();
    };
    const down = on("keydown");
    const up = on("keyup");
    const blur = () => {
      state.current = keysReducer(state.current, { type: "blur", code: "" });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
  return { isDown: (code) => state.current.has(code) };
}

const connectedPad = (): Gamepad | null => {
  if (typeof navigator.getGamepads !== "function") return null;
  return navigator.getGamepads().find((p) => p !== null) ?? null;
};

export function useGamepad(): PadState {
  const sdk = useSdk();
  const visible = useVisible();
  const [pad, setPad] = useState<PadState>(NO_PAD);
  useEffect(() => sdk.capability("gamepad"), [sdk]);
  useEffect(() => {
    if (!visible) return;
    let raf = requestAnimationFrame(function poll() {
      const next = readGamepad(connectedPad());
      setPad((prev) => (samePad(prev, next) ? prev : next));
      raf = requestAnimationFrame(poll);
    });
    return () => cancelAnimationFrame(raf);
  }, [visible]);
  return pad;
}
