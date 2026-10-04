import { disposeObject, fitCameraTo } from "@kibo/sdk/three";
import {
  AmbientLight,
  DirectionalLight,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  Vector3,
} from "three";

export const ROTATION_SPEED = 0.4;

export type ViewerState = "empty" | "loading" | "ready" | "missing" | "failed";

export type Stage = {
  show(model: Object3D): void;
  turn(dt: number): void;
  clear(): void;
};

export function createStage(scene: Scene, camera: PerspectiveCamera, target = new Vector3()): Stage {
  const key = new DirectionalLight(0xffffff, 1.1);
  key.position.set(3, 5, 4);
  scene.add(new AmbientLight(0xffffff, 0.9), key);
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
      scene.add(model);
      fitCameraTo(model, camera, target);
    },
    turn(dt) {
      if (current) current.rotation.y += dt * ROTATION_SPEED;
    },
    clear,
  };
}

export const viewerState = (config: Record<string, unknown>): "empty" | "loading" =>
  typeof config.model === "string" && config.model !== "" ? "loading" : "empty";
