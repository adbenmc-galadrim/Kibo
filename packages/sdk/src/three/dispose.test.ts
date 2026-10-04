import { expect, test } from "bun:test";
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture } from "three";
import { disposeObject } from "./dispose";

test("geometries, materials and textures are disposed once each", () => {
  const texture = new Texture();
  const material = new MeshStandardMaterial({ map: texture });
  const geometry = new BoxGeometry();
  const root = new Group();
  root.add(new Mesh(geometry, material), new Mesh(geometry, material));
  let disposed = 0;
  for (const target of [texture, material, geometry]) target.addEventListener("dispose", () => disposed++);
  expect(disposeObject(root)).toBe(3);
  expect(disposed).toBe(3);
  expect(root.children).toHaveLength(0);
});
