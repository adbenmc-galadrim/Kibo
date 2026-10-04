export const THREE_UI = (title: string) => `import { useSdk } from "@kibo/sdk";
import { fitCameraTo, loadGlb, type ThreeHandle, ThreeCanvas } from "@kibo/sdk/three";
import { useCallback } from "react";
import { AmbientLight, BoxGeometry, DirectionalLight, Mesh, MeshStandardMaterial } from "three";

export function Component() {
  const sdk = useSdk();
  const model = typeof sdk.config.model === "string" ? sdk.config.model : null;
  const setup = useCallback(
    (h: ThreeHandle) => {
      h.scene.add(new AmbientLight(0xffffff, 0.8), new DirectionalLight(0xffffff, 1.2));
      const cube = new Mesh(new BoxGeometry(), new MeshStandardMaterial({ color: 0xf97316 }));
      h.scene.add(cube);
      fitCameraTo(cube, h.camera);
      if (model) {
        sdk.assets
          .url(model)
          .then((asset) => loadGlb(asset.url))
          .then((group) => {
            h.scene.remove(cube);
            h.scene.add(group);
            fitCameraTo(group, h.camera);
          })
          .catch((e: unknown) => console.error("[${title}] model not loaded", e));
      }
    },
    [sdk, model],
  );
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ThreeCanvas label="${title}" setup={setup} frame={(h, dt) => h.scene.rotateY(dt * 0.4)} />
    </div>
  );
}
`;
