import {
  allocateTicketKeys,
  currentTicketSeq,
  enableServerAllocation,
  validateProjectUpdate,
  validateSharedSnapshot,
  writeMembers,
} from "@kibo/core";
import { KiboError, MAX_FRAME_BYTES, type MemberRole, type RejectCode, SYNC_LIMITS } from "@kibo/schema";
import { decodeImportBlobMeta, EphemeralStore, type ImportStatus, LoroDoc, VersionVector } from "loro-crdt";
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
const hasPending = (status: ImportStatus): boolean => status.pending !== null && status.pending.size > 0;

type State = { seq: number; sinceSnapshot: number; size: number };
type SnapshotRow = { bytes: Uint8Array; uptoSeq: number };
type UpdateRow = { seq: number; bytes: Uint8Array };
type Author = { userId: string; deviceId: string };
type Allocation = { ticketId: string; key: string };

function blobMode(blob: Uint8Array): string {
  try {
    return decodeImportBlobMeta(blob, true).mode;
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `unreadable project snapshot: ${String(e)}`);
  }
}

function importSnapshot(snapshot: Uint8Array): LoroDoc {
  if (snapshot.length > MAX_FRAME_BYTES)
    throw new KiboError("INVALID_INPUT", "project snapshot is too large");
  if (blobMode(snapshot) !== "snapshot")
    throw new KiboError("INVALID_INPUT", "a complete snapshot is required");
  const doc = new LoroDoc();
  let pending: boolean;
  try {
    pending = hasPending(doc.import(snapshot));
  } catch (e) {
    throw new KiboError("INVALID_INPUT", `unreadable project snapshot: ${String(e)}`);
  }
  if (pending) throw new KiboError("INVALID_INPUT", "project snapshot depends on missing changes");
  return doc;
}

export type ShareInput = {
  projectId: string;
  name: string;
  ownerId: string;
  ownerName: string;
  snapshot: Uint8Array;
};

function prepareShare(input: ShareInput): { doc: LoroDoc; ticketSeq: number; snapshot: Uint8Array } {
  const doc = importSnapshot(input.snapshot);
  const verdict = validateSharedSnapshot(doc, input.projectId, input.ownerId);
  if (!verdict.ok) throw new KiboError("INVALID_INPUT", verdict.reason);
  const ticketSeq = enableServerAllocation(doc);
  writeMembers(doc, [{ userId: input.ownerId, name: input.ownerName }]);
  return { doc, ticketSeq, snapshot: doc.export({ mode: "snapshot" }) };
}

function insertSnapshot(
  sdb: ServerDb,
  projectId: string,
  doc: LoroDoc,
  snapshot: Uint8Array,
  now: number,
): void {
  sdb.db
    .query("INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, 0, ?4)")
    .run(projectId, snapshot, versionJson(doc), now);
}

export class ProjectRoom {
  readonly presence = new EphemeralStore(SYNC_LIMITS.presenceTimeoutMs);

  private constructor(
    private readonly sdb: ServerDb,
    readonly projectId: string,
    private doc: LoroDoc,
    private readonly state: State,
    private readonly limits: RoomLimits,
  ) {}

  static create(sdb: ServerDb, input: ShareInput, now: number, limits?: Partial<RoomLimits>): ProjectRoom {
    const { doc, ticketSeq, snapshot } = prepareShare(input);
    sdb.db.transaction(() => {
      insertProject(sdb, { id: input.projectId, ownerId: input.ownerId, name: input.name, ticketSeq }, now);
      insertSnapshot(sdb, input.projectId, doc, snapshot, now);
    })();
    return ProjectRoom.fresh(sdb, input.projectId, doc, snapshot, limits);
  }

  static replace(sdb: ServerDb, input: ShareInput, now: number, limits?: Partial<RoomLimits>): ProjectRoom {
    const { doc, ticketSeq, snapshot } = prepareShare(input);
    sdb.db.transaction(() => {
      sdb.db.query("DELETE FROM updates WHERE projectId = ?1").run(input.projectId);
      sdb.db.query("DELETE FROM snapshots WHERE projectId = ?1").run(input.projectId);
      sdb.db
        .query("UPDATE projects SET name = ?2, ticketSeq = ?3 WHERE id = ?1")
        .run(input.projectId, input.name, ticketSeq);
      insertSnapshot(sdb, input.projectId, doc, snapshot, now);
    })();
    return ProjectRoom.fresh(sdb, input.projectId, doc, snapshot, limits);
  }

  private static fresh(
    sdb: ServerDb,
    projectId: string,
    doc: LoroDoc,
    snapshot: Uint8Array,
    limits?: Partial<RoomLimits>,
  ): ProjectRoom {
    return new ProjectRoom(
      sdb,
      projectId,
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
    try {
      return this.doc.export({ mode: "update", from: VersionVector.decode(version) });
    } catch (e) {
      throw new KiboError("INVALID_INPUT", `unreadable version: ${String(e)}`);
    }
  }

  push(bytes: Uint8Array, actor: Actor, now: number): PushResult {
    if (actor.role === "viewer") throw new RoomReject("FORBIDDEN", "viewers cannot write", null);
    if (bytes.length > MAX_FRAME_BYTES) {
      throw new RoomReject("UPDATE_REJECTED", "update is larger than a frame", this.version());
    }
    const candidate = this.readCandidate(bytes);
    const verdict = validateProjectUpdate(this.doc, candidate, actor);
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
    const allocated = allocateTicketKeys(candidate);
    return this.adopt(candidate, { userId: actor.userId, deviceId: actor.deviceId }, now, allocated);
  }

  syncMembers(now: number): PushResult | null {
    const candidate = this.fork();
    writeMembers(
      candidate,
      listMembers(this.sdb, this.projectId).map((m) => ({ userId: m.userId, name: m.name })),
    );
    const result = this.adopt(candidate, { userId: SERVER_AUTHOR, deviceId: SERVER_AUTHOR }, now, []);
    return result.bytes === null ? null : result;
  }

  private fork(): LoroDoc {
    const candidate = this.doc.fork();
    candidate.setPeerId(this.doc.peerId);
    return candidate;
  }

  private readCandidate(bytes: Uint8Array): LoroDoc {
    if (this.updateMode(bytes) !== "update") {
      throw new RoomReject("UPDATE_REJECTED", "only update blobs are accepted", this.version());
    }
    const candidate = this.fork();
    let pending: boolean;
    try {
      pending = hasPending(candidate.import(bytes));
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

  private updateMode(bytes: Uint8Array): string {
    try {
      return decodeImportBlobMeta(bytes, true).mode;
    } catch (e) {
      throw new RoomReject("UPDATE_REJECTED", `unreadable update: ${String(e)}`, this.version());
    }
  }

  private adopt(candidate: LoroDoc, author: Author, now: number, allocated: Allocation[]): PushResult {
    const before = this.doc.oplogVersion();
    if (candidate.oplogVersion().compare(before) === 0) {
      return { bytes: null, serverSeq: this.state.seq, version: this.version(), allocated: [] };
    }
    const delta = candidate.export({ mode: "update", from: before });
    const seq = this.state.seq + 1;
    const compacted =
      this.state.sinceSnapshot + 1 >= this.limits.compactEvery
        ? candidate.export({ mode: "snapshot" })
        : null;
    this.persist(candidate, { seq, delta, compacted, author, now });
    this.doc = candidate;
    this.state.seq = seq;
    this.state.sinceSnapshot = compacted === null ? this.state.sinceSnapshot + 1 : 0;
    this.state.size = compacted === null ? this.state.size + delta.length : compacted.length;
    return { bytes: delta, serverSeq: seq, version: this.version(), allocated };
  }

  private persist(
    candidate: LoroDoc,
    write: { seq: number; delta: Uint8Array; compacted: Uint8Array | null; author: Author; now: number },
  ): void {
    const ticketSeq = currentTicketSeq(candidate);
    this.sdb.db.transaction(() => {
      this.sdb.db
        .query(
          "INSERT INTO updates (projectId, seq, bytes, userId, deviceId, at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        )
        .run(this.projectId, write.seq, write.delta, write.author.userId, write.author.deviceId, write.now);
      this.sdb.db.query("UPDATE projects SET ticketSeq = ?2 WHERE id = ?1").run(this.projectId, ticketSeq);
      if (write.compacted === null) return;
      this.sdb.db
        .query(
          "INSERT INTO snapshots (projectId, bytes, versionJson, uptoSeq, at) VALUES (?1, ?2, ?3, ?4, ?5)",
        )
        .run(this.projectId, write.compacted, versionJson(candidate), write.seq, write.now);
    })();
  }
}
