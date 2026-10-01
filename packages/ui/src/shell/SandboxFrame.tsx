import type { ComponentFormat, Surface } from "@kibo/schema";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { useTheme } from "../theme";
import { createFrameBridge, dispatchCombo, type FrameBridge } from "./frame-bridge";
import { useHost } from "./Host";
import { createLoadGuard, type LoadGuard } from "./load-guard";

type Props = {
  projectId: string;
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  format: ComponentFormat;
  src: string;
  title: string;
  readyTimeoutMs?: number;
};

export function SandboxFrame({
  projectId,
  instanceId,
  config,
  viewer,
  surface,
  format,
  src,
  title,
  readyTimeoutMs = 2000,
}: Props) {
  const host = useHost();
  const theme = useTheme();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const latest = useRef({ config, viewer, theme, surface, format, host });
  latest.current = { config, viewer, theme, surface, format, host };
  const bridge = useRef<FrameBridge | null>(null);
  const guard = useRef<LoadGuard | null>(null);
  const [escaped, setEscaped] = useState(false);

  useLayoutEffect(() => {
    if (escaped) return;
    const g = createLoadGuard({
      readyTimeoutMs,
      onEscape: (reason) => {
        console.error(
          `[kibo-ui] component instance ${instanceId} navigated away from ${src} (${reason}), frame destroyed`,
        );
        setEscaped(true);
        client
          .rpc({ method: "reportComponentRefusal", projectId, instanceId, kind: "navigate" })
          .catch((e: unknown) => console.error(`[kibo-ui] refusal of ${instanceId} not recorded`, e));
      },
      setTimer: (fn, ms) => window.setTimeout(fn, ms),
      clearTimer: (id) => window.clearTimeout(id),
    });
    guard.current = g;
    return () => {
      g.dispose();
      guard.current = null;
    };
  }, [src, projectId, instanceId, readyTimeoutMs, escaped]);

  useEffect(() => {
    if (escaped) return;
    const b = createFrameBridge({
      frame: () => ref.current?.contentWindow ?? null,
      init: () => ({
        instanceId,
        config: latest.current.config,
        viewer: latest.current.viewer,
        theme: latest.current.theme,
        surface: latest.current.surface,
        format: latest.current.format,
      }),
      call: (call) => client.rpc({ method: "componentCall", projectId, instanceId, call }),
      onOpenTicket: (id) => latest.current.host.openTicket(id),
      onOpenNewTicket: (d) => latest.current.host.openNewTicket({ ...d, instanceId }),
      onOpenFile: (r) =>
        latest.current.host.openFile({
          projectId,
          worktree: null,
          path: r.path,
          line: r.line ?? null,
          origin: r.origin ?? null,
        }),
      onOpenView: (id) => latest.current.host.openView(id),
      onKey: (combo) => dispatchCombo(combo),
      onResize: (h) => setHeight(h),
      onReady: () => guard.current?.ready(),
    });
    bridge.current = b;
    window.addEventListener("message", b.handle);
    const off = client.subscribe((id) => {
      if (id === projectId || id === null) b.changed();
    });
    const offPresence = client.subscribeEvents((m) => {
      if (m.type === "presence.changed" && m.projectId === projectId) b.changed();
    });
    return () => {
      window.removeEventListener("message", b.handle);
      off();
      offPresence();
      b.dispose();
      bridge.current = null;
    };
  }, [projectId, instanceId, escaped]);

  useEffect(() => {
    bridge.current?.theme(theme);
  }, [theme]);

  if (escaped) {
    return (
      <p role="alert" className="p-4 text-sm text-destructive">
        {fr.instance.navigated}
      </p>
    );
  }

  return (
    <iframe
      ref={ref}
      onLoad={() => guard.current?.load()}
      title={title}
      src={src}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-transparent"
      style={surface === "widget" && height !== null ? { height } : { height: "100%" }}
    />
  );
}
