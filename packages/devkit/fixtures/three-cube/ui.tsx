import { ThreeCanvas, type ThreeHandle } from "@kibo/sdk/three";
import { BoxGeometry, Mesh, MeshStandardMaterial } from "three";

function addCube({ scene }: ThreeHandle) {
  const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: "#f97316" }));
  scene.add(cube);
  return () => scene.remove(cube);
}

export function Component() {
  return <ThreeCanvas label="Cube" setup={addCube} />;
}
