import {
  allocateTicketKeys,
  currentTicketSeq,
  enableServerAllocation,
  listTickets,
  validateProjectUpdate,
  writeMembers,
} from "@kibo/core";
import { KiboError, MAX_FRAME_BYTES, type MemberRole, type RejectCode, SYNC_LIMITS } from "@kibo/schema";
import { EphemeralStore, LoroDoc, VersionVector } from "loro-crdt";
import { audit } from "./audit";
import type { ServerDb } from "./db";
import { insertProject, listMembers } from "./members";

export type Actor = { userId: string; deviceId: string; role: MemberRole };
export type PushResult = {
  bytes: Uint8Array | null;
  serverSeq: number;
  version: Uint8Array;
  allocated: { ticketId: string; key: string }[];
};
export type RoomLimits = { projectBytes: number; compactEvery: number };

export class RoomReject extends Error {
  constructor(
    readonly code: RejectCode,
    message: string,
    readonly version: Uint8Array | null,
  ) {
    super(message);
    this.name = "RoomReject";
  }
}

const SERVER_AUTHOR = "kibo-server";
const DEFAULT_LIMITS: RoomLimits = {
  projectBytes: SYNC_LIMITS.projectBytes,
  compactEvery: SYNC_LIMITS.compactEvery,
};

const versionJson = (doc: LoroDoc): string => JSON.stringify(Object.fromEntries(doc.oplogVersion().toJSON()));

type State = { seq: number; sinceSnapshot: number; size: number };
type SnapshotRow = { bytes: Uint8Array; uptoSeq: number };
type UpdateRow = { seq: number; bytes: Uint8Array };

function importSnapshot(snapshot: Uint8Array): LoroDoc {
  if (snapshot.length > MAX_FRAME_BYTES)
    throw new KiboError("INVALID_INPUT", "project snapshot is too large");
  const doc = new LoroDoc();
  try {
    doc.import(snapshot);
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `unreadable project snapshot: ${String(e)}`);
  }
  return doc;
}

export class ProjectRoom {
  readonly presence = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);

  private constructor(
    private readonly sdb: ServerDb,
    readonly projectId: string,
    private readonly doc: LoroDoc,
    private readonly state: State,
    private readonly limits: RoomLimits,
  ) {}

  static create(
    sdb: ServerDb,
    input: { projectId: string; name: string; ownerId: string; ownerName: string; snapshot: Uint8Array },
    now: number,
    limits?: Partial<RoomLimits>,
  ): ProjectRoom {
    const doc = importSnapshot(input.snapshot);
    if (listTickets(doc).some((t) => t.key === null)) {
      throw new KiboError("INVALID_INPUT", "a shared snapshot must have a key on every ticket");
    }
    const ticketSeq = enableServerAllocation(doc);
    writeMembers(doc, [{ userId: input.ownerId, name: input.ownerName }]);
    const snapshot = doc.export({ mode: "snapshot" });
    sdb.db.transaction(() => {
      insertProject(sdb, { id: input.projectId, ownerId: input.ownerId, name: input.name, ticketSeq }, now);
      sdb.db
        .query(
          "INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, 0, ?4)",
        )
        .run(input.projectId, snapshot, versionJson(doc), now);
    })();
    return new ProjectRoom(
      sdb,
      input.projectId,
      doc,
      { seq: 0, sinceSnapshot: 0, size: snapshot.length },
      { ...DEFAULT_LIMITS, ...limits },
    );
  }

  static load(sdb: ServerDb, projectId: string, limits?: Partial<RoomLimits>): ProjectRoom {
    const project = sdb.db.query("SELECT id FROM projects WHERE id = ?1").get(projectId);
    if (!project) throw new KiboError("NOT_FOUND", `project ${projectId} is not shared on this server`);
    const snapshot = sdb.db
      .query<SnapshotRow, [string]>(
        "SELECT bytes, uptoSeq FROM snapshots WHERE projectId = ?1 ORDER BY uptoSeq DESC LIMIT 1",
      )
      .get(projectId);
    if (!snapshot) throw new KiboError("STORE_CORRUPT", `project ${projectId} has no snapshot`);
    const rows = sdb.db
      .query<UpdateRow, [string, number]>(
        "SELECT seq, bytes FROM updates WHERE projectId = ?1 AND seq > ?2 ORDER BY seq",
      )
      .all(projectId, snapshot.uptoSeq);
    let doc: LoroDoc;
    try {
      doc = LoroDoc.fromSnapshot(new Uint8Array(snapshot.bytes));
      if (rows.length > 0) doc.importBatch(rows.map((r) => new Uint8Array(r.bytes)));
    } catch (e) {
      throw new KiboError("STORE_CORRUPT", `project ${projectId} history is unreadable: ${String(e)}`);
    }
    const last = rows.at(-1)?.seq ?? snapshot.uptoSeq;
    const size = rows.reduce((total, r) => total + r.bytes.length, snapshot.bytes.length);
    return new ProjectRoom(
      sdb,
      projectId,
      doc,
      { seq: last, sinceSnapshot: rows.length, size },
      { ...DEFAULT_LIMITS, ...limits },
    );
  }

  version(): Uint8Array {
    return this.doc.oplogVersion().encode();
  }

  serverSeq(): number {
    return this.state.seq;
  }

  sizeBytes(): number {
    return this.state.size;
  }

  snapshotBytes(): Uint8Array {
    return this.doc.export({ mode: "snapshot" });
  }

  diffSince(version: Uint8Array | null): Uint8Array {
    if (version === null) return this.doc.export({ mode: "update" });
    return this.doc.export({ mode: "update", from: VersionVector.decode(version) });
  }

  push(bytes: Uint8Array, actor: Actor, now: number): PushResult {
    if (actor.role === "viewer") throw new RoomReject("FORBIDDEN", "viewers cannot write", null);
    if (bytes.length > MAX_FRAME_BYTES) {
      throw new RoomReject("UPDATE_REJECTED", "update is larger than a frame", this.version());
    }
    const candidate = this.readCandidate(bytes);
    const verdict = validateProjectUpdate(this.doc, candidate);
    if (!verdict.ok) {
      audit(this.sdb, {
        at: now,
        kind: "update-rejected",
        userId: actor.userId,
        deviceId: actor.deviceId,
        projectId: this.projectId,
        detail: verdict.reason,
      });
      throw new RoomReject("UPDATE_REJECTED", verdict.reason, this.version());
    }
    if (this.state.size + bytes.length > this.limits.projectBytes) {
      throw new RoomReject("QUOTA_EXCEEDED", "project is over its size quota", this.version());
    }
    const before = this.doc.oplogVersion();
    this.doc.import(bytes);
    const allocated = allocateTicketKeys(this.doc);
    return this.record(before, { userId: actor.userId, deviceId: actor.deviceId }, now, allocated);
  }

  syncMembers(now: number): PushResult | null {
    const before = this.doc.oplogVersion();
    writeMembers(
      this.doc,
      listMembers(this.sdb, this.projectId).map((m) => ({ userId: m.userId, name: m.name })),
    );
    const result = this.record(before, { userId: SERVER_AUTHOR, deviceId: SERVER_AUTHOR }, now, []);
    return result.bytes === null ? null : result;
  }

  private readCandidate(bytes: Uint8Array): LoroDoc {
    const candidate = this.doc.fork();
    let pending: boolean;
    try {
      const status = candidate.import(bytes);
      pending = status.pending !== null && status.pending.size > 0;
    } catch (e) {
      throw new RoomReject("UPDATE_REJECTED", `unreadable update: ${String(e)}`, this.version());
    }
    if (pending) {
      throw new RoomReject(
        "OUT_OF_DATE",
        "update depends on changes the server does not have",
        this.version(),
      );
    }
    return candidate;
  }

  private record(
    before: VersionVector,
    author: { userId: string; deviceId: string },
    now: number,
    allocated: { ticketId: string; key: string }[],
  ): PushResult {
    if (this.doc.oplogVersion().compare(before) === 0) {
      return { bytes: null, serverSeq: this.state.seq, version: this.version(), allocated: [] };
    }
    const delta = this.doc.export({ mode: "update", from: before });
    const seq = this.state.seq + 1;
    const ticketSeq = currentTicketSeq(this.doc);
    this.sdb.db.transaction(() => {
      this.sdb.db
        .query(
          "INSERT INTO updates (projectId, seq, bytes, userId, deviceId, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .run(this.projectId, seq, delta, author.userId, author.deviceId, now);
      this.sdb.db.query("UPDATE projects SET ticketSeq = ?2 WHERE id = ?1").run(this.projectId, ticketSeq);
    })();
    this.state.seq = seq;
    this.state.size += delta.length;
    this.state.sinceSnapshot += 1;
    if (this.state.sinceSnapshot >= this.limits.compactEvery) this.compact(now);
    return { bytes: delta, serverSeq: seq, version: this.version(), allocated };
  }

  private compact(now: number): void {
    const snapshot = this.doc.export({ mode: "snapshot" });
    this.sdb.db
      .query("INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, ?4, ?5)")
      .run(this.projectId, snapshot, versionJson(this.doc), this.state.seq, now);
    this.state.sinceSnapshot = 0;
    this.state.size = snapshot.length;
  }
}
