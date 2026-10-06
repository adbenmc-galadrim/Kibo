import type { LightingSettings } from "@kibo/sdk/three";

export const toConfigPatch = (s: LightingSettings): Record<string, unknown> => ({
  lighting: s.preset,
  lightIntensity: s.intensity,
  shadows: s.shadows,
  environment: s.environment,
});
