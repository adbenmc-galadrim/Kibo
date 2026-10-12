import type { Database } from "bun:sqlite";
import { randomUUID } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  type FileVersion,
  type FileVersionKind,
  KiboError,
  VERSIONS_PER_FILE,
  type VersionOrigin,
  VersionOrigin as VersionOriginSchema,
} from "@kibo/schema";
import { contentHash } from "./guarded-write";

export type DepositInput = {
  kind: FileVersionKind;
  ref: string;
  file: string;
  content: string;
  origin: VersionOrigin;
  by: string | null;
  note: string | null;
};
export type FileHistory = {
  deposit(input: DepositInput): FileVersion;
  list(kind: FileVersionKind, ref: string, file?: string): FileVersion[];
  read(id: string): { version: FileVersion; content: string | null } | null;
  latest(kind: FileVersionKind, ref: string, file: string): FileVersion | null;
  hasHash(kind: FileVersionKind, ref: string, file: string, hash: string): boolean;
  close(): void;
};

type Row = {
  id: string;
  kind: FileVersionKind;
  ref: string;
  file: string;
  hash: string;
  size: number;
  at: number;
  origin: string;
  by: string | null;
  note: string | null;
};

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS file_versions (id TEXT PRIMARY KEY, kind TEXT NOT NULL, ref TEXT NOT NULL, " +
    "file TEXT NOT NULL, hash TEXT NOT NULL, size INTEGER NOT NULL, at INTEGER NOT NULL, origin TEXT NOT NULL, " +
    "by TEXT, note TEXT)",
  "CREATE INDEX IF NOT EXISTS file_versions_by_file ON file_versions (kind, ref, file, at)",
];
const ORDER = "ORDER BY at DESC, rowid DESC";

const segment = (text: string): string => text.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^\.+/, "_") || "_";

export function historyDir(kind: FileVersionKind, ref: string, file: string): string[] {
  const [scope = "", ...rest] = ref.split(":");
  const scoped =
    scope === "project" && rest.length > 1 ? [`project-${rest[0]}`, ...rest.slice(1)] : [scope, ...rest];
  return [kind, ...scoped.map(segment), segment(file.replaceAll("/", "__"))];
}

const versionFile = (home: string, row: Pick<Row, "kind" | "ref" | "file" | "at" | "hash">): string =>
  join(home, "history", ...historyDir(row.kind, row.ref, row.file), `${row.at}-${row.hash.slice(0, 8)}`);

function toVersion(home: string, row: Row): FileVersion {
  const origin = VersionOriginSchema.safeParse(row.origin);
  if (!origin.success) throw new KiboError("STORE_CORRUPT", `file version ${row.id}: origin ${row.origin}`);
  return { ...row, origin: origin.data, missing: !existsSync(versionFile(home, row)) };
}

function writePrivate(path: string, content: string): void {
  mkdirSync(join(path, ".."), { recursive: true, mode: 0o700 });
  writeFileSync(path, content, { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function createFileHistory(input: { home: string; db: Database; now?: () => number }): FileHistory {
  const { home, db } = input;
  const now = input.now ?? Date.now;
  for (const sql of SCHEMA) db.exec(sql);
  const insert = db.query(
    "INSERT INTO file_versions (id, kind, ref, file, hash, size, at, origin, by, note) " +
      "VALUES ($id, $kind, $ref, $file, $hash, $size, $at, $origin, $by, $note)",
  );
  const ofFile = db.query(
    `SELECT * FROM file_versions WHERE kind = $kind AND ref = $ref AND file = $file ${ORDER}`,
  );
  const ofRef = db.query(`SELECT * FROM file_versions WHERE kind = $kind AND ref = $ref ${ORDER}`);
  const byId = db.query("SELECT * FROM file_versions WHERE id = $id");
  const withHash = db.query(
    "SELECT 1 AS found FROM file_versions WHERE kind = $kind AND ref = $ref AND file = $file AND hash = $hash",
  );
  const remove = db.query("DELETE FROM file_versions WHERE id = $id");
  const sharing = db.query(
    "SELECT 1 AS found FROM file_versions WHERE kind = $kind AND ref = $ref AND file = $file AND at = $at AND hash = $hash",
  );

  const rows = (kind: FileVersionKind, ref: string, file: string) => ofFile.all({ kind, ref, file }) as Row[];

  const prune = (kind: FileVersionKind, ref: string, file: string) => {
    for (const row of rows(kind, ref, file).slice(VERSIONS_PER_FILE)) {
      remove.run({ id: row.id });
      const { kind: k, ref: r, file: f, at, hash } = row;
      if (!sharing.get({ kind: k, ref: r, file: f, at, hash }))
        rmSync(versionFile(home, row), { force: true });
    }
  };

  const hasHash = (kind: FileVersionKind, ref: string, file: string, hash: string) =>
    withHash.get({ kind, ref, file, hash }) !== null;

  return {
    deposit(d) {
      const hash = contentHash(d.content);
      if (d.origin === "external" && hasHash(d.kind, d.ref, d.file, hash)) {
        const existing = rows(d.kind, d.ref, d.file).find((r) => r.hash === hash);
        if (existing) return toVersion(home, existing);
      }
      const row: Row = {
        id: randomUUID(),
        kind: d.kind,
        ref: d.ref,
        file: d.file,
        hash,
        size: Buffer.byteLength(d.content),
        at: now(),
        origin: d.origin,
        by: d.by,
        note: d.note,
      };
      writePrivate(versionFile(home, row), d.content);
      insert.run(row);
      prune(d.kind, d.ref, d.file);
      return toVersion(home, row);
    },
    list(kind, ref, file) {
      const found = (
        file === undefined ? ofRef.all({ kind, ref }) : ofFile.all({ kind, ref, file })
      ) as Row[];
      return found.map((row) => toVersion(home, row));
    },
    read(id) {
      const row = byId.get({ id }) as Row | null;
      if (!row) return null;
      const version = toVersion(home, row);
      return { version, content: version.missing ? null : readFileSync(versionFile(home, row), "utf8") };
    },
    latest(kind, ref, file) {
      const row = rows(kind, ref, file)[0];
      return row ? toVersion(home, row) : null;
    },
    hasHash,
    close: () => undefined,
  };
}
