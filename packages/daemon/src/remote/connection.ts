import { type MacMessage, ServerMessage } from "@kibo/remote";
import type { RemoteTimers } from "./timers";

const PING_MS = 30_000;
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
  const waiters = new Set<(open: boolean) => void>();

  const settleWaiters = (value: boolean) => {
    for (const resolve of waiters) resolve(value);
    waiters.clear();
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
    deps.onMessage(message);
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
      stopPing = deps.timers.every(PING_MS, () => send({ type: "ping", at: deps.now() }));
      settleWaiters(true);
      deps.onOpen();
    });
    ws.addEventListener("message", (event) => {
      if (socket === ws) onMessage(event.data);
    });
    ws.addEventListener("close", (event) => {
      if (socket !== ws) return;
      socket = null;
      open = false;
      stopPing?.();
      stopPing = null;
      if (!closed) deps.log(`[kibo-daemon] remote connection closed (${event.code}), retrying`);
      scheduleRetry();
    });
  }

  function send(message: MacMessage): boolean {
    if (!socket || !open) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  connect();
  return {
    send,
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
      ws?.close();
    },
  };
}
