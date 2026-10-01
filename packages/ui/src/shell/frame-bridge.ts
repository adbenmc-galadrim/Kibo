import {
  type ComponentCall,
  type ComponentFormat,
  FrameToHost,
  type HostToFrame,
  type InitMessage,
  type KeyCombo,
  KiboError,
  type Theme,
} from "@kibo/schema";
import type { FileOpenRequest, NewTicketDefaults } from "@kibo/sdk";
import { isMacPlatform } from "../tabs/use-tab-shortcuts";

export const MAX_IN_FLIGHT = 64;

export type BridgeDeps = {
  frame(): Window | null;
  init(): Omit<InitMessage, "kibo" | "type"> & { format: ComponentFormat };
  call(call: ComponentCall): Promise<unknown>;
  onOpenTicket(ticketId: string): void;
  onOpenNewTicket(defaults: NewTicketDefaults): void;
  onOpenFile(request: FileOpenRequest): void;
  onOpenView(componentId: string): void;
  onKey(combo: KeyCombo): void;
  onResize(height: number): void;
  onReady(): void;
  log?: (line: string) => void;
};

export type FrameBridge = {
  handle(e: MessageEvent): void;
  changed(): void;
  theme(t: Theme): void;
  dispose(): void;
};

type CallMessage = Extract<FrameToHost, { type: "call" }>;
type Reply = Extract<HostToFrame, { type: "reply" }>;

function wireError(e: unknown): NonNullable<Reply["error"]> {
  if (e instanceof KiboError) return { code: e.code, message: e.detail };
  console.error("[kibo-ui] component call failed", e);
  return { code: "INTERNAL", message: "internal error" };
}

export function createFrameBridge(deps: BridgeDeps): FrameBridge {
  const log = deps.log ?? ((line: string) => console.warn(`[kibo-ui] ${line}`));
  const inFlight = new Set<number>();
  let disposed = false;
  const send = (msg: HostToFrame) => {
    if (!disposed) deps.frame()?.postMessage(msg, "*");
  };
  const reply = (id: number, outcome: Pick<Reply, "ok" | "result" | "error">) =>
    send({ kibo: 1, type: "reply", id, ...outcome });

  const forward = ({ id, call }: CallMessage) => {
    if (inFlight.has(id)) {
      log(`call ${id} is already in flight, duplicate ignored`);
      return;
    }
    if (inFlight.size >= MAX_IN_FLIGHT) {
      reply(id, { ok: false, error: { code: "TIMEOUT", message: "too many calls in flight" } });
      return;
    }
    inFlight.add(id);
    deps
      .call(call)
      .then(
        (result) => reply(id, { ok: true, result: result ?? null }),
        (err: unknown) => reply(id, { ok: false, error: wireError(err) }),
      )
      .finally(() => inFlight.delete(id));
  };

  const dispatch = (m: FrameToHost) => {
    switch (m.type) {
      case "ready":
        deps.onReady();
        send({ kibo: 1, type: "init", ...deps.init() });
        return;
      case "call":
        forward(m);
        return;
      case "openTicket":
        deps.onOpenTicket(m.ticketId);
        return;
      case "openNewTicket":
        deps.onOpenNewTicket(m.defaults);
        return;
      case "openFile":
        deps.onOpenFile({ path: m.path, line: m.line ?? null, origin: null });
        return;
      case "openView":
        deps.onOpenView(m.componentId);
        return;
      case "key":
        deps.onKey(m.combo);
        return;
      case "resize":
        if (deps.init().surface === "widget") deps.onResize(m.height);
        else log("resize ignored outside a widget");
        return;
    }
  };

  return {
    handle(e) {
      const frame = deps.frame();
      if (!frame || e.source !== frame) {
        log("message from another window ignored");
        return;
      }
      const parsed = FrameToHost.safeParse(e.data);
      if (!parsed.success) {
        log(`invalid frame message ignored: ${parsed.error.message}`);
        return;
      }
      dispatch(parsed.data);
    },
    changed: () => send({ kibo: 1, type: "changed" }),
    theme: (theme) => send({ kibo: 1, type: "theme", theme }),
    dispose: () => {
      disposed = true;
    },
  };
}

export function dispatchCombo(combo: KeyCombo, target: EventTarget = document): void {
  if (combo === "escape") {
    target.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return;
  }
  const key = combo.slice("mod+".length);
  const mac = isMacPlatform(navigator.platform);
  target.dispatchEvent(new KeyboardEvent("keydown", { key, metaKey: mac, ctrlKey: !mac, bubbles: true }));
}
