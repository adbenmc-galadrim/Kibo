import type { Database } from "bun:sqlite";
import { MacMessage, type PhoneEvent, type ServerMessage } from "@kibo/remote/protocol";
import { KiboError } from "@kibo/schema";
import type { ServerWebSocket } from "bun";
import type { PairTokens } from "./pair-tokens";
import type { Relay } from "./relay";
import type { SnapshotStore } from "./snapshots";

const CLOSE_REPLACED = 4409;
export const CLOSE_UNAUTHORIZED = 4401;

type Presence = Extract<PhoneEvent, { type: "mac.presence" }>;

type MacChannelDeps = {
  db: Database;
  snapshots: SnapshotStore;
  pairTokens: PairTokens;
  relay: Relay;
  broadcast(event: PhoneEvent): void;
  revokePhone(): void;
  now(): number;
};

type MacChannel<T> = {
  open(ws: ServerWebSocket<T>): void;
  message(ws: ServerWebSocket<T>, raw: string | Buffer): void;
  close(ws: ServerWebSocket<T>): void;
  deliver(message: ServerMessage): boolean;
  disconnect(code: number, reason: string): void;
  presence(): Presence;
};

const send = <T>(ws: ServerWebSocket<T>, message: ServerMessage) => ws.send(JSON.stringify(message));

function parseMessage(raw: string | Buffer): MacMessage | null {
  try {
    const parsed = MacMessage.safeParse(JSON.parse(String(raw)));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function createMacChannel<T>(deps: MacChannelDeps): MacChannel<T> {
  const { db, snapshots, now } = deps;
  let current: ServerWebSocket<T> | null = null;
  const lastSeen = () =>
    db.query<{ last_seen_at: number | null }, []>("SELECT last_seen_at FROM mac_presence WHERE id = 1").get()
      ?.last_seen_at ?? null;
  const record = (online: boolean, at: number | null) =>
    db.run(
      `INSERT INTO mac_presence (id, online, last_seen_at) VALUES (1, ?, ?)
       ON CONFLICT (id) DO UPDATE SET online = excluded.online, last_seen_at = excluded.last_seen_at`,
      [online ? 1 : 0, at],
    );
  const presence = (): Presence => ({
    type: "mac.presence",
    online: current !== null,
    lastSeenAt: lastSeen(),
  });
  const announce = (online: boolean) => {
    record(online, now());
    deps.broadcast(presence());
  };
  record(false, lastSeen());

  const handle = (ws: ServerWebSocket<T>, message: MacMessage) => {
    switch (message.type) {
      case "snapshot.put": {
        if (!snapshots.put(message.sealed)) return;
        const { projectId, kind, seq } = message.sealed.header;
        return deps.broadcast({ type: "snapshot.changed", projectId, kind, seq });
      }
      case "snapshot.remove":
        if (snapshots.remove(message.projectId, message.kind))
          deps.broadcast({ type: "snapshot.removed", projectId: message.projectId, kind: message.kind });
        return;
      case "project.remove":
        for (const kind of snapshots.removeProject(message.projectId))
          deps.broadcast({ type: "snapshot.removed", projectId: message.projectId, kind });
        return;
      case "pair.create":
        return send(ws, { type: "pair.created", ...deps.pairTokens.create() });
      case "phone.revoke":
        return deps.revokePhone();
      case "request.reply":
        deps.relay.reply(message.requestId, message.sealed);
        return;
      case "ping":
        return send(ws, { type: "pong", at: now() });
    }
  };

  return {
    open: (ws) => {
      const previous = current;
      current = ws;
      if (previous) {
        deps.relay.failAll();
        previous.close(CLOSE_REPLACED, "replaced by a newer connection");
      }
      announce(true);
    },
    message: (ws, raw) => {
      if (ws !== current) return;
      record(true, now());
      const message = parseMessage(raw);
      if (!message)
        return send(ws, { type: "error", code: "INVALID_INPUT", message: "unreadable mac message" });
      try {
        handle(ws, message);
      } catch (e) {
        if (!(e instanceof KiboError)) throw e;
        send(ws, { type: "error", code: e.code, message: e.detail });
      }
    },
    close: (ws) => {
      if (ws !== current) return;
      current = null;
      deps.relay.failAll();
      announce(false);
    },
    deliver: (message) => {
      if (!current) return false;
      send(current, message);
      return true;
    },
    disconnect: (code, reason) => {
      const ws = current;
      if (!ws) return;
      current = null;
      deps.relay.failAll();
      announce(false);
      ws.close(code, reason);
    },
    presence,
  };
}
