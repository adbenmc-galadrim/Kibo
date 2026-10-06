import { expect, test } from "bun:test";
import { INTENSITY_RANGE, LIGHTING_PRESETS, lightingSettings } from "@kibo/sdk/three";
import fc from "fast-check";
import { toConfigPatch } from "./lighting-config";

const settings = fc.record({
  preset: fc.constantFrom(...LIGHTING_PRESETS),
  intensity: fc.double({ min: INTENSITY_RANGE.min, max: INTENSITY_RANGE.max, noNaN: true }),
  shadows: fc.boolean(),
  environment: fc.boolean(),
});

test("toConfigPatch round-trips through lightingSettings and only carries the four lighting keys", () => {
  fc.assert(
    fc.property(settings, (s) => {
      const patch = toConfigPatch(s);
      expect(Object.keys(patch).sort()).toEqual(["environment", "lightIntensity", "lighting", "shadows"]);
      expect(lightingSettings(patch)).toEqual(s);
    }),
  );
});
