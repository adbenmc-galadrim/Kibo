import type { Surface } from "@kibo/schema";
import { useEffect, useRef, useState } from "react";
import { client } from "../api";
import { useTheme } from "../theme";
import { createFrameBridge, dispatchCombo, type FrameBridge } from "./frame-bridge";
import { useHost } from "./Host";

type Props = {
  projectId: string;
  instanceId: string;
  config: Record<string, unknown>;
  viewer: string;
  surface: Surface;
  src: string;
  title: string;
};

export function SandboxFrame({ projectId, instanceId, config, viewer, surface, src, title }: Props) {
  const host = useHost();
  const theme = useTheme();
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  const latest = useRef({ config, viewer, theme, surface, host });
  latest.current = { config, viewer, theme, surface, host };
  const bridge = useRef<FrameBridge | null>(null);

  useEffect(() => {
    const b = createFrameBridge({
      frame: () => ref.current?.contentWindow ?? null,
      init: () => ({
        instanceId,
        config: latest.current.config,
        viewer: latest.current.viewer,
        theme: latest.current.theme,
        surface: latest.current.surface,
      }),
      call: (call) => client.rpc({ method: "componentCall", projectId, instanceId, call }),
      onOpenTicket: (id) => latest.current.host.openTicket(id),
      onOpenNewTicket: (d) => latest.current.host.openNewTicket(d),
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
    });
    bridge.current = b;
    window.addEventListener("message", b.handle);
    const off = client.subscribe((id) => {
      if (id === projectId || id === null) b.changed();
    });
    return () => {
      window.removeEventListener("message", b.handle);
      off();
      b.dispose();
      bridge.current = null;
    };
  }, [projectId, instanceId]);

  useEffect(() => {
    bridge.current?.theme(theme);
  }, [theme]);

  return (
    <iframe
      ref={ref}
      title={title}
      src={src}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      className="block w-full border-0 bg-transparent"
      style={surface === "widget" && height !== null ? { height } : { height: "100%" }}
    />
  );
}
