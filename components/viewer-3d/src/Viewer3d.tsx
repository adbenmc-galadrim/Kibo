import { KiboError } from "@kibo/schema";
import { useSdk } from "@kibo/sdk";
import { loadGlb, ThreeCanvas, type ThreeHandle } from "@kibo/sdk/three";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Group } from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { fr } from "./fr";
import { createStage, type Stage, type ViewerState, viewerState } from "./scene";

function useModel(name: string | null): { state: ViewerState; model: Group | null } {
  const sdk = useSdk();
  const [state, setState] = useState<ViewerState>(viewerState({ model: name }));
  const [model, setModel] = useState<Group | null>(null);
  useEffect(() => {
    setModel(null);
    if (!name) {
      setState("empty");
      return;
    }
    setState("loading");
    let alive = true;
    sdk.assets
      .url(name)
      .then((asset) => loadGlb(asset.url))
      .then(
        (group) => {
          if (!alive) return;
          setModel(group);
          setState("ready");
        },
        (e: unknown) => {
          if (!alive) return;
          const missing = e instanceof KiboError && e.code === "NOT_FOUND";
          if (!missing) console.error("[viewer-3d] model not loaded", e);
          setState(missing ? "missing" : "failed");
        },
      );
    return () => {
      alive = false;
    };
  }, [sdk, name]);
  return { state, model };
}

function Scene3d({ name, model, autoRotate }: { name: string; model: Group | null; autoRotate: boolean }) {
  const stage = useRef<Stage | null>(null);
  const redraw = useRef<(() => void) | null>(null);
  const latest = useRef(model);
  latest.current = model;

  const setup = useCallback((h: ThreeHandle) => {
    const controls = new OrbitControls(h.camera, h.renderer.domElement);
    const draw = () => h.renderer.render(h.scene, h.camera);
    const created = createStage(h.scene, h.camera, controls.target);
    stage.current = created;
    redraw.current = () => {
      controls.update();
      draw();
    };
    controls.addEventListener("change", draw);
    if (latest.current) created.show(latest.current);
    controls.update();
    return () => {
      controls.removeEventListener("change", draw);
      controls.dispose();
      created.clear();
      stage.current = null;
      redraw.current = null;
    };
  }, []);

  useEffect(() => {
    if (!model) return;
    stage.current?.show(model);
    redraw.current?.();
  }, [model]);

  const turn = useCallback((_: ThreeHandle, dt: number) => stage.current?.turn(dt), []);

  return <ThreeCanvas label={fr.label(name)} setup={setup} frame={autoRotate ? turn : undefined} />;
}

function Message({ text, alert = false }: { text: string; alert?: boolean }) {
  return (
    <p role={alert ? "alert" : undefined} className="m-auto p-4 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}

export function Viewer3d() {
  const sdk = useSdk();
  const name = typeof sdk.config.model === "string" && sdk.config.model !== "" ? sdk.config.model : null;
  const autoRotate = sdk.config.autoRotate !== false;
  const { state, model } = useModel(name);
  return (
    <div className="flex h-full min-h-0 flex-col">
      {name && <p className="truncate px-3 pt-2 text-xs text-muted-foreground">{name}</p>}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {state === "empty" && <Message text={fr.empty} />}
        {state === "missing" && <Message text={fr.missing} />}
        {state === "failed" && <Message text={fr.failed} alert />}
        {name && (state === "loading" || state === "ready") && (
          <Scene3d name={name} model={model} autoRotate={autoRotate} />
        )}
        {state === "loading" && (
          <output className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
            {fr.loading}
          </output>
        )}
      </div>
    </div>
  );
}
