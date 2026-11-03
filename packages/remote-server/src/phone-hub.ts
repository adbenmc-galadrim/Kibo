import type { PhoneEvent } from "@kibo/remote/protocol";
import type { ServerWebSocket } from "bun";

type PhoneHub<T> = {
  add(ws: ServerWebSocket<T>): void;
  remove(ws: ServerWebSocket<T>): void;
  broadcast(event: PhoneEvent): void;
  closeAll(code: number, reason: string): void;
};

export function createPhoneHub<T>(): PhoneHub<T> {
  const sockets = new Set<ServerWebSocket<T>>();
  return {
    add: (ws) => {
      sockets.add(ws);
    },
    remove: (ws) => {
      sockets.delete(ws);
    },
    broadcast: (event) => {
      const text = JSON.stringify(event);
      for (const ws of sockets) ws.send(text);
    },
    closeAll: (code, reason) => {
      for (const ws of [...sockets]) ws.close(code, reason);
      sockets.clear();
    },
  };
}
