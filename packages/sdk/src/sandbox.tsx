import {
  type ComponentCall,
  ComponentManifest,
  type FrameToHost,
  HostToFrame,
  type InitMessage,
  isKiboErrorCode,
  KeyCombo,
  KiboError,
  type Theme,
} from "@kibo/schema";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import { SdkProvider } from "./react";
import { createSdk } from "./sdk";
import type { KiboSdk } from "./types";

export type FramePort = { post(msg: FrameToHost): void; listen(cb: (msg: HostToFrame) => void): () => void };

export function windowPort(win: Window = window): FramePort {
  return {
    post: (msg) => win.parent.postMessage(msg, "*"),
    listen: (cb) => {
      const onMessage = (e: MessageEvent) => {
        if (e.source !== win.parent) {
          console.warn("[kibo-sandbox] ignored message from an unknown sender");
          return;
        }
        const parsed = HostToFrame.safeParse(e.data);
        if (!parsed.success) {
          console.warn(`[kibo-sandbox] ignored invalid message: ${parsed.error.message}`);
          return;
        }
        cb(parsed.data);
      };
      win.addEventListener("message", onMessage);
      return () => win.removeEventListener("message", onMessage);
    },
  };
}

type Pending = { resolve(value: unknown): void; reject(error: KiboError): void };

function replyError(error: { code: string; message: string } | undefined): KiboError {
  if (!error) return new KiboError("INTERNAL", "host replied without an error");
  return isKiboErrorCode(error.code)
    ? new KiboError(error.code, error.message)
    : new KiboError("INTERNAL", `${error.code}: ${error.message}`);
}

export function createFrameSdk(
  manifest: ComponentManifest,
  init: InitMessage,
  port: FramePort,
): { sdk: KiboSdk; dispose(): void } {
  let seq = 0;
  const pending = new Map<number, Pending>();
  const listeners = new Set<() => void>();
  const off = port.listen((m) => {
    if (m.type === "changed") {
      for (const listener of listeners) listener();
      return;
    }
    if (m.type !== "reply") return;
    const waiting = pending.get(m.id);
    if (!waiting) {
      console.warn(`[kibo-sandbox] ignored reply to unknown call ${m.id}`);
      return;
    }
    pending.delete(m.id);
    if (m.ok) waiting.resolve(m.result ?? null);
    else waiting.reject(replyError(m.error));
  });
  const call = (c: ComponentCall) =>
    new Promise<unknown>((resolve, reject) => {
      seq += 1;
      pending.set(seq, { resolve, reject });
      port.post({ kibo: 1, type: "call", id: seq, call: c });
    });
  const unsupported = () =>
    Promise.reject(new KiboError("INTERNAL", "a sandboxed component reads through componentCall"));
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
  const sdk = createSdk(
    { snapshot: unsupported, run: unsupported, runs: unsupported, call, subscribe, subscribeRuns: subscribe },
    manifest,
    {
      instanceId: init.instanceId,
      config: init.config,
      viewer: init.viewer,
      surface: init.surface,
      openTicket: (ticketId) => port.post({ kibo: 1, type: "openTicket", ticketId }),
      openNewTicket: ({ statusId, parentId }) =>
        port.post({ kibo: 1, type: "openNewTicket", defaults: { statusId, parentId } }),
      openFile: ({ path, line }) =>
        port.post({ kibo: 1, type: "openFile", path, ...(typeof line === "number" && { line }) }),
      openView: (componentId) => port.post({ kibo: 1, type: "openView", componentId }),
    },
    "gated",
  );
  return {
    sdk,
    dispose: () => {
      off();
      listeners.clear();
      for (const waiting of pending.values()) waiting.reject(new KiboError("INTERNAL", "frame disposed"));
      pending.clear();
    },
  };
}

export function comboOf(e: KeyboardEvent): KeyCombo | null {
  if (e.key === "Escape") return "escape";
  if (!(e.metaKey || e.ctrlKey)) return null;
  const parsed = KeyCombo.safeParse(`mod+${e.key.toLowerCase()}`);
  return parsed.success ? parsed.data : null;
}

const applyTheme = (theme: Theme) => document.documentElement.classList.toggle("dark", theme === "dark");

function rootElement(): HTMLElement {
  const existing = document.getElementById("root");
  if (existing) return existing;
  const created = document.createElement("div");
  created.id = "root";
  return document.body.appendChild(created);
}

function start(manifest: ComponentManifest, init: InitMessage, Component: ComponentType, port: FramePort) {
  applyTheme(init.theme);
  const bodyClasses = [init.surface === "widget" ? "bg-card" : "bg-background", "text-foreground"];
  document.body.classList.add(...bodyClasses);
  const frame = createFrameSdk(manifest, init, port);
  const root = createRoot(rootElement());
  root.render(
    <SdkProvider sdk={frame.sdk}>
      <Component />
    </SdkProvider>,
  );
  const onKey = (e: KeyboardEvent) => {
    const combo = comboOf(e);
    if (!combo) return;
    if (combo !== "escape") e.preventDefault();
    port.post({ kibo: 1, type: "key", combo });
  };
  document.addEventListener("keydown", onKey);
  const resize =
    init.surface === "widget"
      ? new ResizeObserver(() =>
          port.post({
            kibo: 1,
            type: "resize",
            height: Math.min(10_000, Math.ceil(document.documentElement.scrollHeight)),
          }),
        )
      : null;
  resize?.observe(document.body);
  return () => {
    resize?.disconnect();
    document.removeEventListener("keydown", onKey);
    root.unmount();
    frame.dispose();
    document.body.classList.remove(...bodyClasses);
  };
}

export function mountSandboxed(
  manifestInput: unknown,
  Component: ComponentType,
  port: FramePort = windowPort(),
): () => void {
  const manifest = ComponentManifest.parse(manifestInput);
  let stop: (() => void) | null = null;
  const off = port.listen((m) => {
    if (m.type === "theme") applyTheme(m.theme);
    if (m.type !== "init") return;
    if (stop) {
      console.warn("[kibo-sandbox] ignored a second init");
      return;
    }
    stop = start(manifest, m, Component, port);
  });
  port.post({ kibo: 1, type: "ready" });
  return () => {
    off();
    stop?.();
    stop = null;
  };
}
