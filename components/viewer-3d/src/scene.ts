import {
  createLightRig,
  disposeObject,
  enableShadows,
  fitCameraTo,
  type LightingSettings,
} from "@kibo/sdk/three";
import { type Object3D, type PerspectiveCamera, type Scene, Vector3 } from "three";

export const ROTATION_SPEED = 0.4;

export type ViewerState = "empty" | "loading" | "ready" | "missing" | "failed";

export type Stage = {
  show(model: Object3D): void;
  turn(dt: number): void;
  relight(settings: LightingSettings): void;
  clear(): void;
  dispose(): void;
};

export function createStage(
  scene: Scene,
  camera: PerspectiveCamera,
  target = new Vector3(),
  settings: LightingSettings,
): Stage {
  const rig = createLightRig(settings);
  scene.add(rig.group);
  let shadows = settings.shadows;
  let current: Object3D | null = null;
  const clear = () => {
    if (!current) return;
    scene.remove(current);
    disposeObject(current);
    current = null;
  };
  return {
    show(model) {
      if (model === current) return;
      clear();
      current = model;
      enableShadows(model, shadows);
      scene.add(model);
      fitCameraTo(model, camera, target);
      rig.fitShadows(model);
    },
    turn(dt) {
      if (current) current.rotation.y += dt * ROTATION_SPEED;
    },
    relight(next) {
      shadows = next.shadows;
      rig.apply(next);
      if (current) enableShadows(current, shadows);
    },
    clear,
    dispose() {
      clear();
      scene.remove(rig.group);
      rig.dispose();
    },
  };
}

export const viewerState = (config: Record<string, unknown>): "empty" | "loading" =>
  typeof config.model === "string" && config.model !== "" ? "loading" : "empty";
