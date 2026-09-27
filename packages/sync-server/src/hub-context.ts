import type { ServerFrame } from "@kibo/schema";
import type { ServerDb } from "./db";
import type { RateWindow } from "./limits";
import type { RoomRegistry } from "./rooms";

export type HubConnection = {
  id: string;
  ip: string;
  send(frame: ServerFrame): void;
  close(code: number, reason: string): void;
};

export type Session = { userId: string; deviceId: string; name: string };

export type ConnState = {
  conn: HubConnection;
  nonce: string;
  session: Session | null;
  projects: Set<string>;
  queue: Promise<void>;
  authTimer: ReturnType<typeof setTimeout> | null;
};

export type HubContext = {
  sdb: ServerDb;
  rooms: RoomRegistry;
  now: () => number;
  pushes: RateWindow;
  presences: RateWindow;
  connections(): Iterable<ConnState>;
  broadcast(projectId: string, frame: ServerFrame, exceptConnId?: string): void;
  leave(state: ConnState, projectId: string): void;
  membersChanged(projectId: string): void;
  kickDevice(deviceId: string, code: number): void;
};
