import type { Database } from "bun:sqlite";
import { Sealed, SNAPSHOT_MAX_BYTES } from "@kibo/remote/protocol";
import { KiboError } from "@kibo/schema";

const SNAPSHOT_TOTAL_MAX_BYTES = 1_073_741_824;

export type SnapshotStore = {
  put(sealed: Sealed): boolean;
  get(projectId: string, kind: string): Sealed | null;
  list(projectId: string): Sealed[];
  remove(projectId: string, kind: string): boolean;
  removeProject(projectId: string): string[];
  clear(): void;
};

type SnapshotLimits = { now: () => number; maxBytes?: number; maxTotalBytes?: number };

type Row = { header: string; nonce: Uint8Array; ciphertext: Uint8Array };

function decodeCanonical(text: string, field: string): Uint8Array {
  const bytes = Buffer.from(text, "base64url");
  if (bytes.toString("base64url") !== text)
    throw new KiboError("INVALID_INPUT", `${field} is not canonical base64url`);
  return new Uint8Array(bytes);
}

const toSealed = (row: Row): Sealed =>
  Sealed.parse({
    header: JSON.parse(row.header),
    nonce: Buffer.from(row.nonce).toString("base64url"),
    ciphertext: Buffer.from(row.ciphertext).toString("base64url"),
  });

export function createSnapshotStore(db: Database, limits: SnapshotLimits): SnapshotStore {
  const maxBytes = limits.maxBytes ?? SNAPSHOT_MAX_BYTES;
  const maxTotalBytes = limits.maxTotalBytes ?? SNAPSHOT_TOTAL_MAX_BYTES;
  const storedSeq = db.query<{ seq: number }, [string, string]>(
    "SELECT seq FROM snapshots WHERE project_id = ? AND kind = ?",
  );
  const othersSize = db.query<{ total: number }, [string, string]>(
    `SELECT COALESCE(SUM(length(header) + length(nonce) + length(ciphertext)), 0) AS total
     FROM snapshots WHERE NOT (project_id = ? AND kind = ?)`,
  );
  const upsert = db.query<unknown, [string, string, number, string, Uint8Array, Uint8Array, number]>(
    `INSERT INTO snapshots (project_id, kind, seq, header, nonce, ciphertext, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (project_id, kind) DO UPDATE SET
       seq = excluded.seq, header = excluded.header, nonce = excluded.nonce,
       ciphertext = excluded.ciphertext, updated_at = excluded.updated_at`,
  );
  const one = db.query<Row, [string, string]>(
    "SELECT header, nonce, ciphertext FROM snapshots WHERE project_id = ? AND kind = ?",
  );
  const all = db.query<Row, [string]>(
    "SELECT header, nonce, ciphertext FROM snapshots WHERE project_id = ? ORDER BY kind",
  );
  const kinds = db.query<{ kind: string }, [string]>(
    "SELECT kind FROM snapshots WHERE project_id = ? ORDER BY kind",
  );

  const put = db.transaction((sealed: Sealed): boolean => {
    const { projectId, kind, seq } = sealed.header;
    const nonce = decodeCanonical(sealed.nonce, "nonce");
    const ciphertext = decodeCanonical(sealed.ciphertext, "ciphertext");
    if (ciphertext.length > maxBytes)
      throw new KiboError("REMOTE_TOO_LARGE", `snapshot ${projectId}/${kind} is over ${maxBytes} bytes`);
    const previous = storedSeq.get(projectId, kind);
    if (previous && seq < previous.seq) return false;
    const header = JSON.stringify(sealed.header);
    const size = Buffer.byteLength(header) + nonce.length + ciphertext.length;
    if ((othersSize.get(projectId, kind)?.total ?? 0) + size > maxTotalBytes)
      throw new KiboError("REMOTE_TOO_LARGE", `snapshots would exceed ${maxTotalBytes} bytes`);
    upsert.run(projectId, kind, seq, header, nonce, ciphertext, limits.now());
    return true;
  });

  return {
    put: (sealed) => put(sealed),
    get: (projectId, kind) => {
      const row = one.get(projectId, kind);
      return row ? toSealed(row) : null;
    },
    list: (projectId) => all.all(projectId).map(toSealed),
    remove: (projectId, kind) =>
      db.run("DELETE FROM snapshots WHERE project_id = ? AND kind = ?", [projectId, kind]).changes > 0,
    removeProject: (projectId) => {
      const removed = kinds.all(projectId).map((r) => r.kind);
      db.run("DELETE FROM snapshots WHERE project_id = ?", [projectId]);
      return removed;
    },
    clear: () => {
      db.run("DELETE FROM snapshots");
    },
  };
}
