import { type Instance, isBuiltinId, type Surface, sandboxPath, splitRef } from "@kibo/schema";
import { createSdk, projectBackend, SdkProvider } from "@kibo/sdk";
import { useEffect, useMemo, useRef, useState } from "react";
import { client } from "../api";
import { fr } from "../i18n/fr";
import { isRemoteView } from "../lib/remote-view";
import { findComponent } from "../registry";
import { useHost } from "../shell/Host";
import { SandboxFrame } from "../shell/SandboxFrame";
import { loadTrusted, type TrustedModule } from "../shell/trusted-loader";
import { useComponents } from "../state/use-components";
import { useRuntimeInfo } from "../state/use-runtime-info";
import { PendingTrust } from "./PendingTrust";

type Props = { projectId: string; instance: Instance; viewer: string; surface: Surface };
type MountedProps = Props & { mod: TrustedModule; mode: "builtin" | "gated" };
type TrustedProps = Props & { id: string; version: string; hash: string };

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

function Mounted({ projectId, instance, viewer, surface, mod, mode }: MountedProps) {
  const host = useHost();
  const config = useSameContent(instance.config);
  const sdk = useMemo(
    () =>
      createSdk(
        projectBackend(client, projectId, instance.id),
        mod.manifest,
        {
          instanceId: instance.id,
          config,
          viewer,
          surface,
          openTicket: host.openTicket,
          openNewTicket: host.openNewTicket,
          openFile: (r) =>
            host.openFile({
              projectId,
              worktree: null,
              path: r.path,
              line: r.line ?? null,
              origin: r.origin ?? null,
            }),
          openView: host.openView,
        },
        mode,
      ),
    [mod, mode, projectId, instance.id, config, viewer, surface, host],
  );
  return (
    <SdkProvider sdk={sdk}>
      <mod.Component />
    </SdkProvider>
  );
}

function LoadFailed() {
  return (
    <p role="alert" className="p-4 text-sm text-destructive">
      {fr.instance.loadFailed}
    </p>
  );
}

function RemoteSandboxed() {
  return <output className="block p-4 text-sm text-muted-foreground">{fr.security.remoteFrame}</output>;
}

function Unknown({ componentRef }: { componentRef: string }) {
  return <p className="p-6 text-sm text-destructive">{fr.page.unknownComponent(componentRef)}</p>;
}

function Trusted({ id, version, hash, ...props }: TrustedProps) {
  const [mod, setMod] = useState<TrustedModule | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    loadTrusted(id, version, hash).then(
      (m) => {
        if (live) setMod(m);
      },
      (e: unknown) => {
        console.error(e);
        if (live) setFailed(true);
      },
    );
    return () => {
      live = false;
    };
  }, [id, version, hash]);
  if (failed) return <LoadFailed />;
  return mod ? <Mounted {...props} mod={mod} mode="gated" /> : null;
}

function ThirdParty(props: Props) {
  const { instance, surface } = props;
  const { id, version } = splitRef(instance.component);
  const { components, error } = useComponents();
  const runtime = useRuntimeInfo();
  if (error) return <LoadFailed />;
  if (!components) return null;
  const summary = components.find((c) => c.id === id && !c.builtin);
  const v = summary?.versions.find((x) => x.version === version);
  if (!summary || !v) return <Unknown componentRef={instance.component} />;
  if (!v.active || !v.hash || v.tampered) {
    return (
      <PendingTrust
        id={id}
        title={summary.title}
        version={version}
        summary={v}
        tampered={v.tampered}
        compact={surface === "widget"}
      />
    );
  }
  if (v.trust === "trusted") return <Trusted {...props} id={id} version={version} hash={v.hash} />;
  if (isRemoteView()) return <RemoteSandboxed />;
  if (runtime.error) return <LoadFailed />;
  if (!runtime.info) return null;
  return (
    <SandboxFrame
      key={`${instance.component}:${JSON.stringify(instance.config)}`}
      projectId={props.projectId}
      instanceId={instance.id}
      config={instance.config}
      viewer={props.viewer}
      surface={surface}
      title={summary.title}
      src={`${runtime.info.sandboxOrigin}${sandboxPath(id, version, v.hash, "index.html")}`}
    />
  );
}

export function InstanceFrame(props: Props) {
  const ref = props.instance.component;
  const builtin = findComponent(ref);
  if (builtin) return <Mounted {...props} mod={builtin} mode="builtin" />;
  if (isBuiltinId(splitRef(ref).id)) return <Unknown componentRef={ref} />;
  return <ThirdParty {...props} />;
}
