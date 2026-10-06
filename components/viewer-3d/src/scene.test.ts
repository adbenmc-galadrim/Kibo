import { expect, test } from "bun:test";
import { LIGHTING_DEFAULTS } from "@kibo/sdk/three";
import {
  BoxGeometry,
  DirectionalLight,
  Group,
  Light,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
} from "three";
import { createStage, ROTATION_SPEED, viewerState } from "./scene";

test("the scene holds the light rig and swaps the model in place", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const stage = createStage(scene, camera, undefined, LIGHTING_DEFAULTS);
  const rig = scene.getObjectByName("kibo-light-rig");
  expect(rig !== undefined && scene.children.includes(rig)).toBe(true);
  expect(rig?.children.filter((c) => c instanceof Light)).toHaveLength(4);
  const first = new Group();
  stage.show(first);
  expect(scene.children).toContain(first);
  const second = new Group();
  stage.show(second);
  expect(scene.children).not.toContain(first);
  expect(scene.children).toContain(second);
  stage.turn(0.5);
  expect(second.rotation.y).toBeCloseTo(0.5 * ROTATION_SPEED);
  stage.clear();
  expect(scene.children).not.toContain(second);
  expect(viewerState({ model: null })).toBe("empty");
  expect(viewerState({ model: "robot.glb" })).toBe("loading");
});

test("the stage aims the orbit target at the model center", () => {
  const target = new Vector3();
  const stage = createStage(new Scene(), new PerspectiveCamera(), target, LIGHTING_DEFAULTS);
  const model = new Mesh(new BoxGeometry());
  model.position.set(3, 0, 0);
  model.updateMatrixWorld();
  stage.show(model);
  expect(target.toArray()).toEqual([3, 0, 0]);
});

test("relight changes the lights without touching the model", () => {
  const scene = new Scene();
  const stage = createStage(scene, new PerspectiveCamera(), undefined, LIGHTING_DEFAULTS);
  const model = new Mesh(new BoxGeometry(), new MeshStandardMaterial());
  stage.show(model);
  const rig = scene.getObjectByName("kibo-light-rig");
  const key = rig?.children.find((c): c is DirectionalLight => c instanceof DirectionalLight);
  const before = key?.intensity ?? 0;
  stage.relight({ ...LIGHTING_DEFAULTS, preset: "contrast", shadows: true });
  expect(key?.intensity).toBeGreaterThan(before);
  expect(key?.castShadow).toBe(true);
  expect(model.castShadow).toBe(true);
  expect(scene.children).toContain(model);
  stage.dispose();
  expect(scene.getObjectByName("kibo-light-rig")).toBeUndefined();
});
