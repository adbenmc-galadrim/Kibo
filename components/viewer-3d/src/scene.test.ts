import { expect, test } from "bun:test";
import { BoxGeometry, Group, Light, Mesh, PerspectiveCamera, Scene, Vector3 } from "three";
import { createStage, ROTATION_SPEED, viewerState } from "./scene";

test("the scene holds lights and swaps the model in place", () => {
  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const stage = createStage(scene, camera);
  expect(scene.children.filter((c) => c instanceof Light)).toHaveLength(2);
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
  const stage = createStage(new Scene(), new PerspectiveCamera(), target);
  const model = new Mesh(new BoxGeometry());
  model.position.set(3, 0, 0);
  model.updateMatrixWorld();
  stage.show(model);
  expect(target.toArray()).toEqual([3, 0, 0]);
});
