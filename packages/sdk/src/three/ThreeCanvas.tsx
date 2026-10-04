import { useEffect, useRef, useState } from "react";
import { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import { useSdk, useVisible } from "../react";
import { disposeObject } from "./dispose";
import { frThree } from "./fr";
import { clampDt, loopState } from "./scheduler";
import { themeColors } from "./theme-colors";

export type ThreeHandle = {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  width: number;
  height: number;
  dark: boolean;
};

export type ThreeCanvasProps = {
  label: string;
  setup(handle: ThreeHandle): void | (() => void);
  frame?(handle: ThreeHandle, dt: number): void;
  animate?: boolean;
  className?: string;
  createRenderer?(canvas: HTMLCanvasElement): WebGLRenderer | null;
};

function defaultRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
  try {
    if (!canvas.getContext("webgl2") && !canvas.getContext("webgl")) return null;
    return new WebGLRenderer({ canvas, antialias: true, alpha: true });
  } catch (e) {
    console.warn("[kibo-three] renderer unavailable", e);
    return null;
  }
}

const reducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

export function ThreeCanvas({
  label,
  setup,
  frame,
  animate = true,
  className,
  createRenderer = defaultRenderer,
}: ThreeCanvasProps) {
  const sdk = useSdk();
  const visible = useVisible();
  const wake = useRef<(() => void) | null>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [unavailable, setUnavailable] = useState(false);
  const latest = useRef({ frame, animate, visible });
  latest.current = { frame, animate, visible };

  useEffect(() => sdk.capability("webgl"), [sdk]);

  useEffect(() => {
    const el = canvas.current;
    const box = wrapper.current;
    if (!el || !box) return;
    const renderer = createRenderer(el);
    if (!renderer) {
      setUnavailable(true);
      return;
    }
    const scene = new Scene();
    const camera = new PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(2, 1.5, 3);
    const handle: ThreeHandle = { scene, camera, renderer, width: 1, height: 1, dark: false };
    const applyTheme = () => {
      handle.dark = document.documentElement.classList.contains("dark");
      renderer.setClearColor(themeColors().background, 1);
    };
    const draw = () => renderer.render(scene, camera);
    const resize = () => {
      const rect = box.getBoundingClientRect();
      handle.width = Math.max(1, Math.round(rect.width));
      handle.height = Math.max(1, Math.round(rect.height));
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(handle.width, handle.height, false);
      camera.aspect = handle.width / handle.height;
      camera.updateProjectionMatrix();
      draw();
    };
    applyTheme();
    const cleanup = setup(handle);
    resize();
    let previous: number | null = null;
    let raf = 0;
    const tick = (now: number) => {
      raf = 0;
      const state = loopState({
        animate: latest.current.animate && latest.current.frame !== undefined,
        visible: latest.current.visible,
        documentVisible: document.visibilityState !== "hidden",
        reducedMotion: reducedMotion(),
      });
      if (state === "paused") {
        previous = null;
        return;
      }
      latest.current.frame?.(handle, clampDt(previous, now));
      previous = now;
      draw();
      raf = requestAnimationFrame(tick);
    };
    const resume = () => {
      if (raf === 0) raf = requestAnimationFrame(tick);
    };
    wake.current = resume;
    resume();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    observer?.observe(box);
    const theme = new MutationObserver(() => {
      applyTheme();
      draw();
    });
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    document.addEventListener("visibilitychange", resume);
    return () => {
      wake.current = null;
      document.removeEventListener("visibilitychange", resume);
      theme.disconnect();
      observer?.disconnect();
      if (raf !== 0) cancelAnimationFrame(raf);
      if (typeof cleanup === "function") cleanup();
      disposeObject(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [createRenderer, setup]);

  useEffect(() => {
    if (visible && animate) wake.current?.();
  }, [visible, animate]);

  if (unavailable)
    return <output className="block p-4 text-sm text-muted-foreground">{frThree.unavailable}</output>;
  return (
    <div ref={wrapper} className={className ?? "h-full min-h-0 w-full"}>
      <canvas ref={canvas} role="img" aria-label={label} className="block h-full w-full" />
    </div>
  );
}
