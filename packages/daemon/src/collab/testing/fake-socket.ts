import type { ServerFrame } from "@kibo/schema";
import type { Timer } from "../sync-requests";
import type { SyncSocket, SyncTransport } from "../transport";

export type FakeSocket = SyncSocket & {
  sent: string[];
  closedWith: number | null;
  deliver(frame: ServerFrame): void;
  drop(code: number): void;
};
export type FakeTimer = { fn: () => void; ms: number; cancelled: boolean };

export function fakeSocket(): FakeSocket {
  let onMessage: (text: string) => void = () => {};
  let onClose: (code: number) => void = () => {};
  const socket: FakeSocket = {
    sent: [],
    closedWith: null,
    send: (text) => socket.sent.push(text),
    close: (code) => {
      socket.closedWith = code ?? 1000;
      onClose(socket.closedWith);
    },
    onOpen: () => {},
    onMessage: (fn) => {
      onMessage = fn;
    },
    onClose: (fn) => {
      onClose = fn;
    },
    deliver: (frame) => onMessage(JSON.stringify(frame)),
    drop: (code) => onClose(code),
  };
  return socket;
}

export type FakeNetwork = {
  sockets: FakeSocket[];
  timers: FakeTimer[];
  transport: SyncTransport;
  setTimer: Timer;
  pending(): FakeTimer[];
  last(): FakeSocket;
};

export function fakeNetwork(): FakeNetwork {
  const sockets: FakeSocket[] = [];
  const timers: FakeTimer[] = [];
  return {
    sockets,
    timers,
    transport: {
      open: () => {
        const socket = fakeSocket();
        sockets.push(socket);
        return socket;
      },
    },
    setTimer: (fn, ms) => {
      const timer = { fn, ms, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
    pending: () => timers.filter((t) => !t.cancelled),
    last: () => {
      const socket = sockets.at(-1);
      if (!socket) throw new Error("no socket opened");
      return socket;
    },
  };
}

export async function until(predicate: () => boolean): Promise<void> {
  for (let i = 0; i < 400 && !predicate(); i++) await Bun.sleep(5);
  if (!predicate()) throw new Error("condition not met");
}
