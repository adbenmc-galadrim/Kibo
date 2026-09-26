import { type ClientFrame, type RejectCode, type ServerFrame, SYNC_LIMITS } from "@kibo/schema";
import { fromBase64, toBase64 } from "@kibo/trust";
import { LoroDoc, VersionVector } from "loro-crdt";

export type SyncHost = {
  doc(): LoroDoc;
  applyRemote(bytes: Uint8Array): void;
  replaceDoc(doc: LoroDoc): void;
};
export type ProjectSyncOptions = {
  projectId: string;
  host: SyncHost;
  send(frame: ClientFrame): void;
  serverVersion: Uint8Array | null;
  saveServerVersion(version: Uint8Array | null): void;
  newBatchId(): string;
  schedule(fn: () => void, ms: number): void;
  onRejected(code: RejectCode, message: string): void;
};
type Incoming = Extract<ServerFrame, { type: "update" | "ack" | "reject" }>;
type Reject = Extract<Incoming, { type: "reject" }>;
type Batch = { id: string; from: VersionVector };

const covers = (version: VersionVector, target: VersionVector): boolean => {
  const order = version.compare(target);
  return order === 0 || order === 1;
};

export class ProjectSync {
  private online = false;
  private flushQueued = false;
  private batch: Batch | null = null;
  private fresh: LoroDoc | null = null;
  private serverVersion: Uint8Array | null;

  constructor(private readonly opts: ProjectSyncOptions) {
    this.serverVersion = opts.serverVersion;
  }

  get inFlight(): string | null {
    return this.batch?.id ?? null;
  }

  get resyncing(): boolean {
    return this.fresh !== null;
  }

  connected(): void {
    this.online = true;
    this.batch = null;
    const version = this.fresh === null ? toBase64(this.opts.host.doc().oplogVersion().encode()) : null;
    this.opts.send({ type: "subscribe", projectId: this.opts.projectId, version });
  }

  disconnected(): void {
    this.online = false;
    this.batch = null;
  }

  localChange(): void {
    if (this.flushQueued) return;
    this.flushQueued = true;
    this.opts.schedule(() => {
      this.flushQueued = false;
      this.flush();
    }, SYNC_LIMITS.batchMs);
  }

  resync(): void {
    this.fresh = new LoroDoc();
    this.batch = null;
    this.adoptServerVersion(null);
    if (this.online) this.opts.send({ type: "subscribe", projectId: this.opts.projectId, version: null });
  }

  flush(): void {
    if (!this.online || this.batch !== null || this.fresh !== null || this.serverVersion === null) return;
    const doc = this.opts.host.doc();
    const server = VersionVector.decode(this.serverVersion);
    if (covers(server, doc.oplogVersion())) return;
    const id = this.opts.newBatchId();
    this.batch = { id, from: server };
    this.opts.send({
      type: "push",
      projectId: this.opts.projectId,
      bytes: toBase64(doc.export({ mode: "update", from: server })),
      clientBatchId: id,
    });
  }

  receive(frame: Incoming): void {
    if (frame.type === "update") {
      this.applyUpdate(fromBase64(frame.bytes), fromBase64(frame.version));
      return;
    }
    const batch = this.batch;
    if (batch === null || frame.clientBatchId !== batch.id) return;
    this.batch = null;
    if (frame.type === "ack") {
      this.adoptServerVersion(fromBase64(frame.version));
      this.flush();
      return;
    }
    this.handleReject(frame, batch);
  }

  private handleReject(frame: Reject, batch: Batch): void {
    if (frame.code === "OUT_OF_DATE" && frame.version !== null) {
      const version = fromBase64(frame.version);
      if (VersionVector.decode(version).compare(batch.from) !== 0) {
        this.adoptServerVersion(version);
        this.flush();
        return;
      }
    }
    this.opts.onRejected(frame.code, frame.message);
    if (frame.code === "UPDATE_REJECTED") this.resync();
  }

  private applyUpdate(bytes: Uint8Array, version: Uint8Array): void {
    if (this.fresh === null) {
      this.opts.host.applyRemote(bytes);
      this.adoptServerVersion(version);
      this.flush();
      return;
    }
    this.fresh.import(bytes);
    if (!covers(this.fresh.oplogVersion(), VersionVector.decode(version))) return;
    const complete = this.fresh;
    this.fresh = null;
    this.opts.host.replaceDoc(complete);
    this.adoptServerVersion(version);
  }

  private adoptServerVersion(version: Uint8Array | null): void {
    this.serverVersion = version;
    this.opts.saveServerVersion(version);
  }
}
