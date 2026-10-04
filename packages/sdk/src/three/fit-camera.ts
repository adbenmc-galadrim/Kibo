import { Box3, type Object3D, type PerspectiveCamera, Vector3 } from "three";

export function fitCameraTo(object: Object3D, camera: PerspectiveCamera, target = new Vector3()): void {
  const box = new Box3().setFromObject(object);
  const size = box.getSize(new Vector3()).length() || 1;
  box.getCenter(target);
  const distance = size / (2 * Math.tan((camera.fov * Math.PI) / 360));
  camera.position.copy(target).add(new Vector3(0.6, 0.45, 1).normalize().multiplyScalar(distance * 1.3));
  camera.near = distance / 100;
  camera.far = distance * 100;
  camera.lookAt(target);
  camera.updateProjectionMatrix();
}
