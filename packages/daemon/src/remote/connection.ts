import { type MacMessage, ServerMessage } from "@kibo/remote";
import type { RemoteTimers } from "./timers";

const PING_MS = 30_000;
const SILENT_MS = 2 * PING_MS;
const BACKOFF_FIRST_MS = 1_000;
const BACKOFF_MAX_MS = 60_000;

type ConnectionDeps = {
  serverUrl: string;
  macToken: string;
  timers: RemoteTimers;
  now(): number;
  log(line: string): void;
  onOpen(): void;
  onMessage(message: ServerMessage): void;
};

export type RemoteConnection = {
  send(message: MacMessage): boolean;
  sendConfirmed(message: MacMessage, timeoutMs: number): Promise<boolean>;
  connected(): boolean;
  opened(timeoutMs: number): Promise<boolean>;
  close(): void;
};

const macSocketUrl = (serverUrl: string): string =>
  `${serverUrl.replace(/\/+$/, "").replace(/^http/, "ws")}/api/mac`;

const backoffMs = (attempt: number): number => Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** attempt);

function parseServerMessage(data: unknown): ServerMessage | null {
  try {
    const parsed = ServerMessage.safeParse(JSON.parse(String(data)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function openConnection(deps: ConnectionDeps): RemoteConnection {
  let socket: WebSocket | null = null;
  let open = false;
  let closed = false;
  let attempt = 0;
  let stopPing: (() => void) | null = null;
  let cancelRetry: (() => void) | null = null;
  let lastPongAt = 0;
  let pings = 0;
  let pongs = 0;
  const waiters = new Set<(open: boolean) => void>();
  const pongWaiters = new Set<{ until: number; resolve(confirmed: boolean): void }>();

  const settleWaiters = (value: boolean) => {
    for (const resolve of waiters) resolve(value);
    waiters.clear();
  };

  const failPongWaiters = () => {
    for (const waiter of pongWaiters) waiter.resolve(false);
    pongWaiters.clear();
  };

  const onPong = () => {
    lastPongAt = deps.now();
    pongs++;
    for (const waiter of pongWaiters) {
      if (pongs < waiter.until) continue;
      pongWaiters.delete(waiter);
      waiter.resolve(true);
    }
  };

  const scheduleRetry = () => {
    if (closed || cancelRetry) return;
    const delay = backoffMs(attempt++);
    cancelRetry = deps.timers.after(delay, () => {
      cancelRetry = null;
      connect();
    });
  };

  const onMessage = (data: unknown) => {
    const message = parseServerMessage(data);
    if (!message) return deps.log("[kibo-daemon] remote server sent an unreadable message");
    if (message.type === "error")
      deps.log(`[kibo-daemon] remote server refused ${message.code}: ${message.message}`);
    if (message.type === "pong") onPong();
    deps.onMessage(message);
  };

  const ping = (): number | null => (send({ type: "ping", at: deps.now() }) ? ++pings : null);

  const drop = (ws: WebSocket, reason: string) => {
    if (socket !== ws) return;
    socket = null;
    open = false;
    stopPing?.();
    stopPing = null;
    failPongWaiters();
    if (!closed) deps.log(`[kibo-daemon] remote connection ${reason}, retrying`);
    scheduleRetry();
  };

  const watch = (ws: WebSocket) => {
    if (deps.now() - lastPongAt < SILENT_MS) {
      ping();
      return;
    }
    drop(ws, "silent for two pings");
    ws.close();
  };

  function connect() {
    if (closed) return;
    const ws = new WebSocket(macSocketUrl(deps.serverUrl), {
      headers: { authorization: `Bearer ${deps.macToken}` },
    });
    socket = ws;
    ws.addEventListener("open", () => {
      if (socket !== ws) return;
      open = true;
      attempt = 0;
      lastPongAt = deps.now();
      pings = 0;
      pongs = 0;
      stopPing = deps.timers.every(PING_MS, () => watch(ws));
      settleWaiters(true);
      deps.onOpen();
    });
    ws.addEventListener("message", (event) => {
      if (socket === ws) onMessage(event.data);
    });
    ws.addEventListener("close", (event) => drop(ws, `closed (${event.code})`));
  }

  function send(message: MacMessage): boolean {
    if (!socket || !open) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  const sendConfirmed = (message: MacMessage, timeoutMs: number): Promise<boolean> => {
    if (!send(message)) return Promise.resolve(false);
    const until = ping();
    if (until === null) return Promise.resolve(false);
    return new Promise((resolve) => {
      const waiter = {
        until,
        resolve: (confirmed: boolean) => {
          clearTimeout(timer);
          resolve(confirmed);
        },
      };
      const timer = setTimeout(() => {
        pongWaiters.delete(waiter);
        resolve(false);
      }, timeoutMs);
      pongWaiters.add(waiter);
    });
  };

  connect();
  return {
    send,
    sendConfirmed,
    connected: () => open,
    opened: (timeoutMs) => {
      if (open) return Promise.resolve(true);
      return new Promise((resolve) => {
        const done = (value: boolean) => {
          clearTimeout(timer);
          resolve(value);
        };
        const timer = setTimeout(() => {
          waiters.delete(done);
          resolve(false);
        }, timeoutMs);
        waiters.add(done);
      });
    },
    close: () => {
      closed = true;
      cancelRetry?.();
      stopPing?.();
      const ws = socket;
      socket = null;
      open = false;
      settleWaiters(false);
      failPongWaiters();
      ws?.close();
    },
  };
}
