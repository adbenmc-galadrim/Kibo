import { expect, test } from "bun:test";
import { Mesh, MeshStandardMaterial } from "three";
import { sampleGlb } from "./fixtures";
import { parseGlb } from "./three/load-glb";

test("the sample glb is a valid binary gltf holding one orange cube", async () => {
  const bytes = sampleGlb();
  expect(new TextDecoder().decode(bytes.subarray(0, 4))).toBe("glTF");
  expect(new DataView(bytes.buffer).getUint32(4, true)).toBe(2);
  expect(new DataView(bytes.buffer).getUint32(8, true)).toBe(bytes.byteLength);
  const group = await parseGlb(bytes.slice().buffer);
  const meshes: Mesh[] = [];
  group.traverse((n) => {
    if (n instanceof Mesh) meshes.push(n);
  });
  expect(meshes).toHaveLength(1);
  const [cube] = meshes;
  expect(cube?.geometry.index?.count).toBe(36);
  expect(cube?.geometry.getAttribute("position").count).toBe(8);
  expect(cube?.material).toBeInstanceOf(MeshStandardMaterial);
});
