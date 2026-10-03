import { type ComponentFormat, type ComponentManifest, surfaceFor, type Theme } from "@kibo/schema";
import { useEffect, useLayoutEffect, useRef } from "react";
import { formatBox } from "../lib/format-box";
import type { BridgeDeps, FrameBridge } from "../shell/frame-bridge";
import { createLoadGuard, type EscapeReason, type LoadGuard } from "../shell/load-guard";
import { DEMO_VIEWER } from "./preview-protocol";
import type { PreviewBackend } from "./worker-backend";

export const PREVIEW_GRID_WIDTH = 1196;
const PREVIEW_INSTANCE = "draft-preview";
const ignore = () => {};

export type DraftPreviewWindowProps = {
  src: string;
  title: string;
  manifest: ComponentManifest;
  format: ComponentFormat;
  theme: Theme;
  scale: number;
  backend: Pick<PreviewBackend, "call" | "subscribe">;
  createBridge(deps: BridgeDeps): FrameBridge;
  readyTimeoutMs: number;
  onFailed(reason: EscapeReason): void;
};

export function previewBox(format: ComponentFormat): { width: number; height: number } {
  return formatBox(format, PREVIEW_GRID_WIDTH);
}

export function DraftPreviewWindow({
  src,
  title,
  manifest,
  format,
  theme,
  scale,
  backend,
  createBridge,
  readyTimeoutMs,
  onFailed,
}: DraftPreviewWindowProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const guard = useRef<LoadGuard | null>(null);
  const bridge = useRef<FrameBridge | null>(null);
  const latest = useRef({ theme, onFailed });
  latest.current = { theme, onFailed };
  const surface = surfaceFor(manifest, format);

  useLayoutEffect(() => {
    const g = createLoadGuard({
      readyTimeoutMs,
      onEscape: (reason) => {
        console.error(`[kibo-ui] draft preview ${src} failed to load (${reason})`);
        latest.current.onFailed(reason);
      },
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
    });
    guard.current = g;
    return () => {
      g.dispose();
      guard.current = null;
    };
  }, [src, readyTimeoutMs]);

  useEffect(() => {
    const b = createBridge({
      frame: () => ref.current?.contentWindow ?? null,
      init: () => ({
        instanceId: PREVIEW_INSTANCE,
        config: {},
        viewer: DEMO_VIEWER,
        theme: latest.current.theme,
        surface,
        format,
      }),
      call: (call) => backend.call(call),
      onOpenTicket: ignore,
      onOpenNewTicket: ignore,
      onOpenFile: ignore,
      onOpenView: ignore,
      onKey: ignore,
      onResize: ignore,
      onReady: () => guard.current?.ready(),
    });
    bridge.current = b;
    window.addEventListener("message", b.handle);
    const off = backend.subscribe(() => b.changed());
    return () => {
      window.removeEventListener("message", b.handle);
      off();
      b.dispose();
      bridge.current = null;
    };
  }, [createBridge, backend, surface, format]);

  useEffect(() => {
    bridge.current?.theme(theme);
  }, [theme]);

  const box = previewBox(format);
  return (
    <div
      className="shrink-0 overflow-hidden"
      style={{ width: box.width * scale, height: box.height * scale }}
    >
      <iframe
        ref={ref}
        onLoad={() => guard.current?.load()}
        title={title}
        src={src}
        sandbox="allow-scripts"
        referrerPolicy="no-referrer"
        className="block rounded-md border bg-background"
        style={{
          width: box.width,
          height: box.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      />
    </div>
  );
}
