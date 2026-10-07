import {
  Box3,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  NeutralToneMapping,
  type Object3D,
  PCFSoftShadowMap,
  PlaneGeometry,
  PMREMGenerator,
  type ShadowMapType,
  ShadowMaterial,
  SRGBColorSpace,
  type Texture,
  type ToneMapping,
  Vector3,
  type WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

export const LIGHTING_PRESETS = ["soft", "studio", "contrast"] as const;
export type LightingPreset = (typeof LIGHTING_PRESETS)[number];
export type LightingSettings = {
  preset: LightingPreset;
  intensity: number;
  shadows: boolean;
  environment: boolean;
};
export const LIGHTING_DEFAULTS: LightingSettings = {
  preset: "soft",
  intensity: 1,
  shadows: false,
  environment: true,
};
export const INTENSITY_RANGE = { min: 0.25, max: 2 } as const;
export type PresetLevels = {
  hemisphere: number;
  key: number;
  fill: number;
  rim: number;
  environment: number;
};
export const PRESET_LEVELS: Record<LightingPreset, PresetLevels> = {
  soft: { hemisphere: 1, key: 0.9, fill: 0.35, rim: 0, environment: 0.2 },
  studio: { hemisphere: 0.6, key: 1.3, fill: 0.6, rim: 0.5, environment: 0.25 },
  contrast: { hemisphere: 0.25, key: 2, fill: 0.15, rim: 0, environment: 0.1 },
};

export const environmentIntensity = (s: LightingSettings): number =>
  PRESET_LEVELS[s.preset].environment * s.intensity;

const GROUND_SIZE = 20;
const SHADOW_MAP = 1024;

const isPreset = (v: unknown): v is LightingPreset => LIGHTING_PRESETS.some((p) => p === v);
const inRange = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= INTENSITY_RANGE.min && v <= INTENSITY_RANGE.max;

export function lightingSettings(config: Record<string, unknown>): LightingSettings {
  return {
    preset: isPreset(config.lighting) ? config.lighting : LIGHTING_DEFAULTS.preset,
    intensity: inRange(config.lightIntensity) ? config.lightIntensity : LIGHTING_DEFAULTS.intensity,
    shadows: typeof config.shadows === "boolean" ? config.shadows : LIGHTING_DEFAULTS.shadows,
    environment: typeof config.environment === "boolean" ? config.environment : LIGHTING_DEFAULTS.environment,
  };
}

export type LightRig = {
  group: Group;
  key: DirectionalLight;
  apply(settings: LightingSettings): void;
  fitShadows(model: Object3D): void;
  dispose(): void;
};

export function createLightRig(settings: LightingSettings): LightRig {
  const group = new Group();
  group.name = "kibo-light-rig";
  const hemisphere = new HemisphereLight(0xffffff, 0x9a9a9a, 1);
  const key = new DirectionalLight(0xffffff, 1);
  key.position.set(3, 5, 4);
  key.shadow.mapSize.set(SHADOW_MAP, SHADOW_MAP);
  key.shadow.bias = -0.0005;
  const fill = new DirectionalLight(0xffffff, 1);
  fill.position.set(-4, 2, -3);
  const rim = new DirectionalLight(0xffffff, 1);
  rim.position.set(0, 4, -6);
  const ground = new Mesh(new PlaneGeometry(GROUND_SIZE, GROUND_SIZE), new ShadowMaterial({ opacity: 0.3 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  ground.visible = false;
  group.add(hemisphere, key, key.target, fill, rim, ground);
  const apply = (s: LightingSettings) => {
    const levels = PRESET_LEVELS[s.preset];
    hemisphere.intensity = levels.hemisphere * s.intensity;
    key.intensity = levels.key * s.intensity;
    fill.intensity = levels.fill * s.intensity;
    rim.intensity = levels.rim * s.intensity;
    rim.visible = levels.rim > 0;
    key.castShadow = s.shadows;
    ground.visible = s.shadows;
  };
  apply(settings);
  return {
    group,
    key,
    apply,
    fitShadows(model) {
      const box = new Box3().setFromObject(model);
      if (box.isEmpty()) return;
      const size = box.getSize(new Vector3());
      const center = box.getCenter(new Vector3());
      const extent = Math.max(size.x, size.z, 0.5) * 4;
      ground.position.set(center.x, box.min.y, center.z);
      ground.scale.setScalar(extent / GROUND_SIZE);
      key.target.position.copy(center);
      key.target.updateMatrixWorld();
      const camera = key.shadow.camera;
      camera.left = -extent / 2;
      camera.right = extent / 2;
      camera.top = extent / 2;
      camera.bottom = -extent / 2;
      camera.near = 0.1;
      camera.far = extent * 4;
      camera.updateProjectionMatrix();
    },
    dispose() {
      ground.geometry.dispose();
      ground.material.dispose();
      key.shadow.dispose();
    },
  };
}

export type ToneMappingTarget = {
  outputColorSpace: string;
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  shadowMap: { enabled: boolean; type: ShadowMapType; needsUpdate: boolean };
};

export function applyToneMapping(target: ToneMappingTarget, settings: LightingSettings): void {
  target.outputColorSpace = SRGBColorSpace;
  target.toneMapping = NeutralToneMapping;
  target.toneMappingExposure = 1;
  target.shadowMap.enabled = settings.shadows;
  target.shadowMap.type = PCFSoftShadowMap;
  target.shadowMap.needsUpdate = true;
}

export function enableShadows(root: Object3D, enabled: boolean): void {
  root.traverse((child) => {
    if (!(child instanceof Mesh)) return;
    child.castShadow = enabled;
    child.receiveShadow = enabled;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    for (const material of materials) material.needsUpdate = true;
  });
}

export function createEnvironment(renderer: WebGLRenderer): { texture: Texture; dispose(): void } {
  const generator = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const target = generator.fromScene(room, 0.04);
  generator.dispose();
  return { texture: target.texture, dispose: () => target.dispose() };
}
