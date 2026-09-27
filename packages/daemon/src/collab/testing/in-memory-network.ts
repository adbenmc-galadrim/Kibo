import type { ClientFrame, RejectCode, ServerFrame } from "@kibo/schema";
import { type Actor, type ProjectRoom, RoomReject } from "@kibo/sync-server";
import { fromBase64, toBase64 } from "@kibo/trust";
import type { LoroDoc } from "loro-crdt";
import { ProjectSync } from "../project-sync";
import { createMemoryHost, type MemoryHost } from "./memory-host";

type Down = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;

export type NetClient = {
  readonly index: number;
  readonly sync: ProjectSync;
  readonly host: MemoryHost;
  readonly up: ClientFrame[];
  readonly down: Down[];
  readonly timers: (() => void)[];
  readonly rejected: { code: RejectCode; message: string }[];
  connected: boolean;
  subscribed: boolean;
};

const MAX_ROUNDS = 10_000;

export class InMemoryNetwork {
  readonly clients: NetClient[] = [];
  readonly allocated: { ticketId: string; key: string }[] = [];
  private batches = 0;

  constructor(
    private readonly room: ProjectRoom,
    private readonly actor: Actor,
    private readonly now: () => number,
  ) {}

  addClient(doc: LoroDoc): NetClient {
    const up: ClientFrame[] = [];
    const down: Down[] = [];
    const timers: (() => void)[] = [];
    const rejected: { code: RejectCode; message: string }[] = [];
    const host = createMemoryHost(doc);
    const sync = new ProjectSync({
      projectId: this.room.projectId,
      host,
      send: (frame) => up.push(frame),
      serverVersion: this.room.version(),
      saveServerVersion: () => {},
      newBatchId: () => {
        this.batches += 1;
        return `b${this.batches}`;
      },
      schedule: (fn) => timers.push(fn),
      onRejected: (code, message) => rejected.push({ code, message }),
    });
    const client: NetClient = {
      index: this.clients.length,
      sync,
      host,
      up,
      down,
      timers,
      rejected,
      connected: false,
      subscribed: false,
    };
    this.clients.push(client);
    return client;
  }

  connect(c: NetClient): void {
    if (c.connected) return;
    c.connected = true;
    c.sync.connected();
  }

  disconnect(c: NetClient): void {
    if (!c.connected) return;
    c.connected = false;
    c.subscribed = false;
    c.up.length = 0;
    c.down.length = 0;
    c.sync.disconnected();
  }

  stepUp(c: NetClient): boolean {
    const frame = c.up.shift();
    if (frame === undefined) return false;
    this.serve(c, frame);
    return true;
  }

  stepDown(c: NetClient): boolean {
    const frame = c.down.shift();
    if (frame === undefined) return false;
    c.sync.receive(frame);
    return true;
  }

  runTimers(c: NetClient): boolean {
    const due = c.timers.splice(0);
    for (const fn of due) fn();
    return due.length > 0;
  }

  drain(): void {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      let progressed = false;
      for (const c of this.clients) {
        if (this.runTimers(c)) progressed = true;
        while (this.stepUp(c)) progressed = true;
        while (this.stepDown(c)) progressed = true;
      }
      if (!progressed) return;
    }
    throw new Error(`in-memory network did not settle after ${MAX_ROUNDS} rounds`);
  }

  private update(bytes: Uint8Array, serverSeq: number, version: Uint8Array): Down {
    return {
      type: "update",
      projectId: this.room.projectId,
      bytes: toBase64(bytes),
      serverSeq,
      version: toBase64(version),
    };
  }

  private serve(c: NetClient, frame: ClientFrame): void {
    if (frame.type === "subscribe") {
      c.subscribed = true;
      const since = frame.version === null ? null : fromBase64(frame.version);
      c.down.push(this.update(this.room.diffSince(since), this.room.serverSeq(), this.room.version()));
      return;
    }
    if (frame.type !== "push") throw new Error(`unexpected ${frame.type} frame in the in-memory network`);
    try {
      const result = this.room.push(fromBase64(frame.bytes), this.actor, this.now());
      this.allocated.push(...result.allocated);
      c.down.push({
        type: "ack",
        projectId: this.room.projectId,
        clientBatchId: frame.clientBatchId,
        serverSeq: result.serverSeq,
        version: toBase64(result.version),
      });
      if (result.bytes === null) return;
      const broadcast = this.update(result.bytes, result.serverSeq, result.version);
      for (const other of this.clients) if (other.connected && other.subscribed) other.down.push(broadcast);
    } catch (e) {
      if (!(e instanceof RoomReject)) throw e;
      c.down.push({
        type: "reject",
        projectId: this.room.projectId,
        clientBatchId: frame.clientBatchId,
        code: e.code,
        message: e.message,
        version: e.version === null ? null : toBase64(e.version),
      });
    }
  }
}
