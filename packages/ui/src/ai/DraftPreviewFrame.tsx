import {
  type ComponentFormat,
  type ComponentManifest,
  type DraftStatus,
  KiboError,
  type Theme,
} from "@kibo/schema";
import { Button } from "@kibo/sdk/ui/button";
import { Skeleton } from "@kibo/sdk/ui/skeleton";
import { useCallback, useEffect, useRef, useState } from "react";
import { client } from "../api";
import { frCreations } from "../i18n/fr-creations";
import { type BridgeDeps, createFrameBridge, type FrameBridge } from "../shell/frame-bridge";
import type { EscapeReason } from "../shell/load-guard";
import { useRuntimeInfo } from "../state/use-runtime-info";
import { aiErrorMessage } from "./ai-error";
import { DraftPreviewWindow, previewBox } from "./DraftPreviewWindow";
import { fitScale } from "./preview-scale";
import { createWorkerBackend, type PreviewBackend } from "./worker-backend";

export type DraftPreviewFrameProps = {
  draftId: string;
  manifest: ComponentManifest;
  format: ComponentFormat;
  theme: Theme;
  available?: number;
  createBridge?: (deps: BridgeDeps) => FrameBridge;
  createBackend?: (manifest: ComponentManifest) => PreviewBackend;
  readyTimeoutMs?: number;
};

type State =
  | { kind: "building" }
  | { kind: "ready"; src: string; build: number }
  | { kind: "failed"; detail: string };

const t = frCreations.preview;
const PREVIEWABLE: ReadonlySet<DraftStatus> = new Set(["review", "permissions"]);
const refusals: Partial<Record<string, string>> = t.errors;

function refusalOf(e: unknown): string {
  const known = e instanceof KiboError ? refusals[e.code] : undefined;
  return known ?? aiErrorMessage(e);
}

function useSameContent<T>(value: T): T {
  const kept = useRef(value);
  if (JSON.stringify(kept.current) !== JSON.stringify(value)) kept.current = value;
  return kept.current;
}

export function DraftPreviewFrame(props: DraftPreviewFrameProps) {
  const [session, setSession] = useState(0);
  const manifest = useSameContent(props.manifest);
  return (
    <PreviewSession
      key={`${props.draftId}:${session}`}
      {...props}
      manifest={manifest}
      onRetry={() => setSession((n) => n + 1)}
    />
  );
}

function PreviewSession({
  draftId,
  manifest,
  format,
  theme,
  available = 0,
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
        if (e.type !== "draft.changed" || e.draftId !== draftId || !PREVIEWABLE.has(e.status)) return;
        retried.current = false;
        build();
      }),
    [draftId, build],
  );

  const onFailed = (reason: EscapeReason) => {
    if (reason === "reload") {
      setState({ kind: "failed", detail: t.navigated });
      return;
    }
    if (retried.current) {
      setState({ kind: "failed", detail: t.loadFailed });
      return;
    }
    retried.current = true;
    build();
  };

  const box = previewBox(format);
  const scale = fitScale(available, box.width);
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
  if (state.kind !== "ready" || backend === null)
    return (
      <Skeleton
        role="status"
        aria-label={t.building}
        className="shrink-0"
        style={{ width: box.width * scale, height: box.height * scale }}
      />
    );
  return (
    <DraftPreviewWindow
      key={`${state.build}:${format}`}
      src={state.src}
      title={t.frameTitle(manifest.title)}
      manifest={manifest}
      format={format}
      theme={theme}
      scale={scale}
      backend={backend}
      createBridge={createBridge}
      readyTimeoutMs={readyTimeoutMs}
      onFailed={onFailed}
    />
  );
}
