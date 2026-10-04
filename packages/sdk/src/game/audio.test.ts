import { expect, test } from "bun:test";
import { KiboError } from "@kibo/schema";
import { createAudio } from "./audio";

test("createAudio needs the capability and stays silent without a context", () => {
  const denied = {
    capability: () => {
      throw new KiboError("PERMISSION_DENIED", "x");
    },
  };
  expect(() => createAudio(denied)).toThrow("PERMISSION_DENIED");
  const silent = createAudio({ capability: () => undefined }, () => null);
  expect(() => silent.beep(440, 50)).not.toThrow();
  const started: number[] = [];
  const ctx = {
    currentTime: 0,
    destination: {},
    createOscillator: () => ({
      frequency: { value: 0 },
      connect() {},
      start: (t: number) => started.push(t),
      stop() {},
    }),
    createGain: () => ({ gain: { value: 0 }, connect() {} }),
  } as unknown as AudioContext;
  createAudio({ capability: () => undefined }, () => ctx).beep(440, 50);
  expect(started).toEqual([0]);
});
