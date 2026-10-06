import { expect, test } from "bun:test";
import fc from "fast-check";
import {
  ACESFilmicToneMapping,
  BasicShadowMap,
  BoxGeometry,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PCFSoftShadowMap,
  Vector3,
} from "three";
import {
  applyToneMapping,
  createLightRig,
  enableShadows,
  environmentIntensity,
  INTENSITY_RANGE,
  LIGHTING_DEFAULTS,
  LIGHTING_PRESETS,
  type LightingPreset,
  lightingSettings,
  PRESET_LEVELS,
  type ToneMappingTarget,
} from "./lighting";

test("lightingSettings is tolerant and defaults to soft lighting", () => {
  expect(lightingSettings({})).toEqual(LIGHTING_DEFAULTS);
  expect(
    lightingSettings({ lighting: "studio", lightIntensity: 1.5, shadows: true, environment: false }),
  ).toEqual({ preset: "studio", intensity: 1.5, shadows: true, environment: false });
  expect(lightingSettings({ lighting: "neon", lightIntensity: 5, shadows: "yes", environment: 0 })).toEqual(
    LIGHTING_DEFAULTS,
  );
  expect(lightingSettings({ lightIntensity: "2" }).intensity).toBe(1);
  expect(lightingSettings({ lightIntensity: Number.NaN }).intensity).toBe(1);
  fc.assert(
    fc.property(fc.dictionary(fc.string(), fc.anything()), (config) => {
      const s = lightingSettings(config);
      expect(LIGHTING_PRESETS).toContain(s.preset);
      expect(s.intensity).toBeGreaterThanOrEqual(INTENSITY_RANGE.min);
      expect(s.intensity).toBeLessThanOrEqual(INTENSITY_RANGE.max);
    }),
  );
});

test("the rig holds one hemisphere and three directional lights scaled by the preset and the intensity", () => {
  const rig = createLightRig(LIGHTING_DEFAULTS);
  const lights = rig.group.children;
  expect(lights.filter((l) => l instanceof HemisphereLight)).toHaveLength(1);
  const directional = lights.filter((l): l is DirectionalLight => l instanceof DirectionalLight);
  expect(directional).toHaveLength(3);
  expect(rig.key.intensity).toBeCloseTo(PRESET_LEVELS.soft.key);
  rig.apply({ ...LIGHTING_DEFAULTS, intensity: 2 });
  expect(rig.key.intensity).toBeCloseTo(PRESET_LEVELS.soft.key * 2);
  rig.apply({ ...LIGHTING_DEFAULTS, preset: "contrast" });
  expect(rig.key.intensity).toBeGreaterThan(PRESET_LEVELS.soft.key);
  expect(PRESET_LEVELS.contrast.hemisphere).toBeLessThan(PRESET_LEVELS.soft.hemisphere);
  expect(PRESET_LEVELS.studio.rim).toBeGreaterThan(0);
  expect(PRESET_LEVELS.soft.rim).toBe(0);
  rig.dispose();
});

test("shadows turn the key light and the ground on, and fit under the model", () => {
  const rig = createLightRig({ ...LIGHTING_DEFAULTS, shadows: true });
  const ground = rig.group.children.find((c): c is Mesh => c instanceof Mesh);
  expect(rig.key.castShadow).toBe(true);
  expect(ground?.visible).toBe(true);
  const model = new Mesh(new BoxGeometry(2, 4, 2), new MeshStandardMaterial());
  model.position.set(1, 5, 0);
  model.updateMatrixWorld();
  rig.fitShadows(model);
  expect(ground?.position.toArray()).toEqual([1, 3, 0]);
  rig.apply(LIGHTING_DEFAULTS);
  expect(rig.key.castShadow).toBe(false);
  expect(ground?.visible).toBe(false);
  enableShadows(model, true);
  expect(model.castShadow).toBe(true);
  expect(model.receiveShadow).toBe(true);
});

test("applyToneMapping sets ACES, exposure 1 and the shadow map", () => {
  const target: ToneMappingTarget = {
    toneMapping: NoToneMapping,
    toneMappingExposure: 0,
    shadowMap: { enabled: false, type: BasicShadowMap, needsUpdate: false },
  };
  applyToneMapping(target, { ...LIGHTING_DEFAULTS, shadows: true });
  expect(target).toEqual({
    toneMapping: ACESFilmicToneMapping,
    toneMappingExposure: 1,
    shadowMap: { enabled: true, type: PCFSoftShadowMap, needsUpdate: true },
  });
  applyToneMapping(target, LIGHTING_DEFAULTS);
  expect(target.shadowMap.enabled).toBe(false);
});

const lambert = (rig: ReturnType<typeof createLightRig>, normal: Vector3) =>
  rig.group.children
    .filter((l): l is DirectionalLight => l instanceof DirectionalLight && l.visible)
    .reduce((sum, l) => sum + l.intensity * Math.max(0, l.position.clone().normalize().dot(normal)), 0);

test("the environment is a fill light: direct lights dominate in every preset and presets shade a cube differently", () => {
  for (const preset of LIGHTING_PRESETS) {
    const s = { ...LIGHTING_DEFAULTS, preset };
    const levels = PRESET_LEVELS[preset];
    const direct = levels.hemisphere + levels.key + levels.fill + levels.rim;
    expect(environmentIntensity(s)).toBe(levels.environment);
    expect(environmentIntensity(s)).toBeLessThanOrEqual(0.35);
    expect(direct).toBeGreaterThanOrEqual(2 * levels.environment);
  }
  expect(environmentIntensity({ ...LIGHTING_DEFAULTS, intensity: 2 })).toBeCloseTo(
    PRESET_LEVELS.soft.environment * 2,
  );
  const top = new Vector3(0, 1, 0);
  const away = new Vector3(-1, 0, 0);
  const ratio = (preset: LightingPreset) => {
    const rig = createLightRig({ ...LIGHTING_DEFAULTS, preset });
    const r = lambert(rig, top) / lambert(rig, away);
    rig.dispose();
    return r;
  };
  const ratios = LIGHTING_PRESETS.map(ratio);
  expect(new Set(ratios.map((r) => r.toFixed(2))).size).toBe(3);
  expect(ratio("contrast")).toBeGreaterThan(ratio("soft"));
});
