import { type ComponentCall, type ComponentManifest, KiboError, type KiboErrorCode } from "@kibo/schema";
import { type PreviewPort, type PreviewRequest, parsePreviewReply } from "./preview-protocol";

export type PreviewWorker = {
  port: PreviewPort;
  onError(listener: (e: Event) => void): void;
  terminate(): void;
};

export type PreviewBackend = {
  call(call: ComponentCall): Promise<unknown>;
  subscribe(listener: () => void): () => void;
  onFailure(listener: () => void): () => void;
  dispose(): void;
};

const RELAYED_CODES = [
  "INVALID_INPUT",
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "CONFLICT",
  "INVALID_TRANSITION",
  "TREE_CYCLE",
  "LINK_CYCLE",
  "BLOCKED_REASON_REQUIRED",
  "QUOTA_EXCEEDED",
  "MCP_FAILED",
  "FILE_CHANGED",
  "TOO_LARGE",
  "STORE_CORRUPT",
] as const satisfies readonly KiboErrorCode[];

export const relayedCode = (code: string): KiboErrorCode =>
  RELAYED_CODES.find((c) => c === code) ?? "INTERNAL";

type Pending = { resolve(value: unknown): void; reject(error: unknown): void };

export function spawnPreviewWorker(): PreviewWorker {
  const worker = new Worker(new URL("./draft-preview-worker.ts", import.meta.url), { type: "module" });
  return {
    port: worker,
    onError: (listener) => worker.addEventListener("error", listener),
    terminate: () => worker.terminate(),
  };
}

export function createWorkerBackend(
  manifest: ComponentManifest,
  spawn: () => PreviewWorker = spawnPreviewWorker,
): PreviewBackend {
  const pending = new Map<number, Pending>();
  const listeners = new Set<() => void>();
  const failureListeners = new Set<() => void>();
  let failed = false;
  let worker: PreviewWorker | null = null;
  let nextId = 0;
  let disposed = false;

  const onMessage = (e: MessageEvent) => {
    const reply = parsePreviewReply(e.data);
    if (!reply) {
      console.warn("[kibo-ui] invalid draft preview reply ignored");
      return;
    }
    if (reply.type === "changed") {
      for (const l of listeners) l();
      return;
    }
    const waiting = pending.get(reply.id);
    pending.delete(reply.id);
    if (!waiting) return;
    if (reply.type === "result") waiting.resolve(reply.result);
    else waiting.reject(new KiboError(relayedCode(reply.code), reply.message));
  };
  const rejectAll = (code: KiboErrorCode, message: string) => {
    for (const p of pending.values()) p.reject(new KiboError(code, message));
    pending.clear();
  };
  const onError = (e: Event) => {
    console.error("[kibo-ui] draft preview worker failed", e);
    failed = true;
    rejectAll("INTERNAL", "preview unavailable");
    for (const l of failureListeners) l();
  };
  const post = (request: PreviewRequest) => {
    if (!worker) {
      worker = spawn();
      worker.port.addEventListener("message", onMessage);
      worker.onError(onError);
      worker.port.postMessage({ type: "init", manifest } satisfies PreviewRequest);
    }
    worker.port.postMessage(request);
  };

  return {
    call(call) {
      if (disposed) return Promise.reject(new KiboError("INVALID_INPUT", "preview closed"));
      if (failed) return Promise.reject(new KiboError("INTERNAL", "preview unavailable"));
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        post({ type: "call", id, call });
      });
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onFailure(listener) {
      failureListeners.add(listener);
      return () => {
        failureListeners.delete(listener);
      };
    },
    dispose() {
      disposed = true;
      listeners.clear();
      failureListeners.clear();
      rejectAll("INVALID_INPUT", "preview closed");
      worker?.port.removeEventListener("message", onMessage);
      worker?.terminate();
      worker = null;
    },
  };
}
