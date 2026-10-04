import type { KiboSdk } from "../types";

export type GameAudio = { beep(frequency: number, ms: number): void };

const defaultContext = (): AudioContext | null => {
  const Ctor = Reflect.get(globalThis, "AudioContext");
  return typeof Ctor === "function" ? new (Ctor as new () => AudioContext)() : null;
};

export function createAudio(
  sdk: Pick<KiboSdk, "capability">,
  context: () => AudioContext | null = defaultContext,
): GameAudio {
  sdk.capability("audio");
  let ctx: AudioContext | null | undefined;
  return {
    beep(frequency, ms) {
      if (ctx === undefined) ctx = context();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = frequency;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + ms / 1000);
    },
  };
}
