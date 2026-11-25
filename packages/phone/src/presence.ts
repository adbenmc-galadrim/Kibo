import { PhoneEvent } from "@kibo/remote";
import type { Connectivity, PresenceSource } from "./remote-client";

export type SocketHandlers = { onOpen(): void; onMessage(data: unknown): void; onClose(code: number): void };
export type PresenceSocket = { close(): void };

export type PresenceEnvironment = {
  isOnline(): boolean;
  isVisible(): boolean;
  listen(name: "online" | "offline" | "visibilitychange", handler: () => void): () => void;
  schedule(run: () => void, ms: number): () => void;
};

type PresenceDeps = {
  url: string;
  openSocket(url: string, handlers: SocketHandlers): PresenceSocket;
  env: PresenceEnvironment;
  onEvent(event: PhoneEvent): void;
  onOpen(): void;
  onRevoked(): void;
  onResume(): void;
  onUnopened(): void;
};

export type PresenceChannel = PresenceSource & { start(): void; stop(): void };

const CLOSE_REVOKED = 4401;
const FIRST_RETRY_MS = 1_000;
const MAX_RETRY_MS = 30_000;
const RECONNECTING_MAX_MS = MAX_RETRY_MS;

export function browserEnvironment(): PresenceEnvironment {
  return {
    isOnline: () => navigator.onLine,
    isVisible: () => document.visibilityState === "visible",
    listen(name, handler) {
      const target = name === "visibilitychange" ? document : window;
      target.addEventListener(name, handler);
      return () => target.removeEventListener(name, handler);
    },
    schedule(run, ms) {
      const timer = setTimeout(run, ms);
      return () => clearTimeout(timer);
    },
  };
}

function parseEvent(data: unknown): PhoneEvent | null {
  if (typeof data !== "string") return null;
  try {
    const parsed = PhoneEvent.safeParse(JSON.parse(data));
    return parsed.success ? parsed.data : null;
  } catch {
    console.error("[kibo-phone] ignored a non-JSON event");
    return null;
  }
}

export function browserSocket(url: string, handlers: SocketHandlers): PresenceSocket {
  const socket = new WebSocket(url);
  socket.onopen = () => handlers.onOpen();
  socket.onmessage = (event) => handlers.onMessage(event.data);
  socket.onclose = (event) => handlers.onClose(event.code);
  return socket;
}

export function createPresence(deps: PresenceDeps): PresenceChannel {
  const { env } = deps;
  const listeners = new Set<() => void>();
  let state: Connectivity = { macOnline: false, phoneOnline: env.isOnline(), reconnecting: true };
  let socket: PresenceSocket | null = null;
  let retryMs = FIRST_RETRY_MS;
  let waitedMs = 0;
  let cancelRetry: (() => void) | null = null;
  let stopped = true;
  let offs: (() => void)[] = [];

  const set = (next: Partial<Connectivity>) => {
    const merged = { ...state, ...next };
    if (
      merged.macOnline === state.macOnline &&
      merged.phoneOnline === state.phoneOnline &&
      merged.reconnecting === state.reconnecting
    )
      return;
    state = merged;
    for (const l of [...listeners]) l();
  };

  const connect = () => {
    cancelRetry?.();
    cancelRetry = null;
    if (stopped || socket || !env.isOnline()) return;
    let opened = false;
    const current: PresenceSocket = deps.openSocket(deps.url, {
      onOpen: () => {
        if (socket !== current) return;
        opened = true;
        retryMs = FIRST_RETRY_MS;
        deps.onOpen();
      },
      onMessage: (data) => {
        const event = socket === current ? parseEvent(data) : null;
        if (!event) return;
        if (event.type === "mac.presence") {
          waitedMs = 0;
          set({ macOnline: event.online, reconnecting: false });
        }
        deps.onEvent(event);
      },
      onClose: (code) => {
        if (socket !== current) return;
        socket = null;
        set({ macOnline: false, reconnecting: code !== CLOSE_REVOKED && waitedMs < RECONNECTING_MAX_MS });
        if (code === CLOSE_REVOKED) return deps.onRevoked();
        if (!opened && env.isOnline()) deps.onUnopened();
        retry();
      },
    });
    socket = current;
  };

  const retry = () => {
    if (stopped || !env.isOnline() || !env.isVisible() || cancelRetry) return;
    const wait = retryMs;
    retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
    waitedMs += wait;
    cancelRetry = env.schedule(() => {
      cancelRetry = null;
      connect();
    }, wait);
  };

  const resume = () => {
    retryMs = FIRST_RETRY_MS;
    waitedMs = 0;
    deps.onResume();
    const previous = socket;
    socket = null;
    previous?.close();
    connect();
  };

  return {
    get: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (!stopped) return;
      stopped = false;
      offs = [
        env.listen("online", () => {
          set({ phoneOnline: true });
          resume();
        }),
        env.listen("offline", () => set({ phoneOnline: false })),
        env.listen("visibilitychange", () => {
          if (env.isVisible()) resume();
        }),
      ];
      connect();
    },
    stop() {
      stopped = true;
      for (const off of offs) off();
      cancelRetry?.();
      cancelRetry = null;
      socket?.close();
      socket = null;
    },
  };
}
