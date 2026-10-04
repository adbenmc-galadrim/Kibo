import { type Material, Mesh, type Object3D, Texture } from "three";

const isDisposable = (v: unknown): v is { dispose(): void } =>
  typeof v === "object" && v !== null && typeof Reflect.get(v, "dispose") === "function";

function texturesOf(material: Material): Texture[] {
  return Object.values(material).filter((v): v is Texture => v instanceof Texture);
}

export function disposeObject(root: Object3D): number {
  const seen = new Set<unknown>();
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    seen.add(node.geometry);
    const materials: Material[] = Array.isArray(node.material) ? node.material : [node.material];
    for (const material of materials) {
      for (const texture of texturesOf(material)) seen.add(texture);
      seen.add(material);
    }
  });
  for (const target of seen) if (isDisposable(target)) target.dispose();
  root.clear();
  return seen.size;
}
