import { type ComponentFormat, type ComponentManifest, KiboError, type Theme } from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frCreations } from "../i18n/fr-creations";
import { type BridgeDeps, createFrameBridge, type FrameBridge } from "../shell/frame-bridge";
import { useRuntimeInfo } from "../state/use-runtime-info";
import { aiErrorMessage } from "./ai-error";
import { DraftPreviewWindow, previewBox } from "./DraftPreviewWindow";
import { createWorkerBackend, type PreviewBackend } from "./worker-backend";

export type DraftPreviewFrameProps = {
  draftId: string;
  manifest: ComponentManifest;
  format: ComponentFormat;
  theme: Theme;
  createBridge?: (deps: BridgeDeps) => FrameBridge;
  createBackend?: (manifest: ComponentManifest) => PreviewBackend;
  readyTimeoutMs?: number;
};

type State =
  | { kind: "building" }
  | { kind: "ready"; src: string; build: number }
  | { kind: "failed"; detail: string };

const t = frCreations.preview;
const refusals: Partial<Record<string, string>> = t.errors;

function refusalOf(e: unknown): string {
  const known = e instanceof KiboError ? refusals[e.code] : undefined;
  return known ?? aiErrorMessage(e);
}

export function DraftPreviewFrame(props: DraftPreviewFrameProps) {
  const [session, setSession] = useState(0);
  return <PreviewSession key={session} {...props} onRetry={() => setSession((n) => n + 1)} />;
}

function PreviewSession({
  draftId,
  manifest,
  format,
  theme,
  createBridge = createFrameBridge,
  createBackend = createWorkerBackend,
  readyTimeoutMs = 4_000,
  onRetry,
}: DraftPreviewFrameProps & { onRetry(): void }) {
  const runtime = useRuntimeInfo();
  const origin = runtime.info?.sandboxOrigin ?? null;
  const [state, setState] = useState<State>({ kind: "building" });
  const request = useRef(0);
  const retried = useRef(false);
  const [backend, setBackend] = useState<PreviewBackend | null>(null);
  useEffect(() => {
    const b = createBackend(manifest);
    setBackend(b);
    const off = b.onFailure(() => setState({ kind: "failed", detail: t.demoFailed }));
    return () => {
      off();
      b.dispose();
    };
  }, [createBackend, manifest]);

  const build = useCallback(() => {
    if (origin === null) return;
    const current = ++request.current;
    setState({ kind: "building" });
    client.rpc({ method: "previewComponentDraft", draftId }).then(
      (p) => {
        if (request.current === current)
          setState({ kind: "ready", src: `${origin}${p.path}`, build: current });
      },
      (e: unknown) => {
        if (request.current === current) setState({ kind: "failed", detail: refusalOf(e) });
      },
    );
  }, [draftId, origin]);

  useEffect(() => {
    build();
    return () => {
      request.current++;
    };
  }, [build]);

  useEffect(
    () =>
      client.subscribeAi((e) => {
        if (e.type === "draft.changed" && e.draftId === draftId) build();
      }),
    [draftId, build],
  );

  const onFailed = () => {
    if (retried.current) {
      setState({ kind: "failed", detail: t.loadFailed });
      return;
    }
    retried.current = true;
    build();
  };

  const failure = runtime.error ? t.loadFailed : state.kind === "failed" ? state.detail : null;
  if (failure !== null)
    return (
      <div role="alert" className="grid w-full justify-items-start gap-2 text-sm">
        <p className="font-medium text-destructive">{t.unavailable}</p>
        <p className="text-muted-foreground">{failure}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t.retry}
        </Button>
      </div>
    );
  if (state.kind !== "ready" || backend === null) {
    const box = previewBox(format);
    return (
      <Skeleton
        role="status"
        aria-label={t.building}
        className="shrink-0"
        style={{ width: box.width, height: box.height }}
      />
    );
  }
  return (
    <DraftPreviewWindow
      key={`${state.build}:${format}`}
      src={state.src}
      title={t.frameTitle(manifest.title)}
      manifest={manifest}
      format={format}
      theme={theme}
      backend={backend}
      createBridge={createBridge}
      readyTimeoutMs={readyTimeoutMs}
      onReady={() => {
        retried.current = false;
      }}
      onFailed={onFailed}
    />
  );
}
