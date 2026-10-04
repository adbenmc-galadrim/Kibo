import type { Group } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export function parseGlb(bytes: ArrayBuffer): Promise<Group> {
  const loader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    loader.parse(
      bytes,
      "",
      (gltf) => resolve(gltf.scene),
      (e) => reject(e instanceof Error ? e : new Error(String(e))),
    );
  });
}

export async function loadGlb(url: string, fetchFn: typeof fetch = fetch): Promise<Group> {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`glb request failed: ${res.status}`);
  return parseGlb(await res.arrayBuffer());
}
