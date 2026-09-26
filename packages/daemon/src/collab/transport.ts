import { KiboError } from "@kibo/schema";

export type SyncSocket = {
  send(text: string): void;
  close(code?: number): void;
  onOpen(fn: () => void): void;
  onMessage(fn: (text: string) => void): void;
  onClose(fn: (code: number) => void): void;
};
export type SyncTransport = { open(url: string, opts: { ca: string | null }): SyncSocket };

const LOOPBACK = new Set(["127.0.0.1", "localhost", "[::1]"]);
const UNSUPPORTED_DATA = 1003;

export function assertSyncUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `invalid sync url ${url}: ${String(e)}`);
  }
  if (parsed.protocol === "wss:") return parsed;
  if (parsed.protocol === "ws:") {
    if (LOOPBACK.has(parsed.hostname)) return parsed;
    throw new KiboError(
      "TLS_REQUIRED",
      `unencrypted sync is only allowed on loopback, not ${parsed.hostname}`,
    );
  }
  throw new KiboError("INVALID_INPUT", `unsupported sync scheme ${parsed.protocol}`);
}

export function createWebSocketTransport(): SyncTransport {
  return {
    open(url, opts) {
      const target = assertSyncUrl(url);
      const ws = opts.ca === null ? new WebSocket(target) : new WebSocket(target, { tls: { ca: opts.ca } });
      return {
        send: (text) => ws.send(text),
        close: (code) => ws.close(code),
        onOpen: (fn) => ws.addEventListener("open", () => fn()),
        onMessage: (fn) =>
          ws.addEventListener("message", (event) => {
            if (typeof event.data === "string") {
              fn(event.data);
              return;
            }
            console.error("[kibo-daemon] sync: binary frame refused", { url: target.origin });
            ws.close(UNSUPPORTED_DATA);
          }),
        onClose: (fn) => ws.addEventListener("close", (event) => fn(event.code)),
      };
    },
  };
}
