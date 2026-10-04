import type { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  DESIGN_CACHE_IDLE_MS,
  DesignProvider,
  FrameMime,
  frameExtension,
  KiboError,
  MAX_DESIGN_CACHE_BYTES,
  MAX_DESIGN_FRAME_BYTES,
  sniffImage,
} from "@kibo/schema";
import { immediateTransaction } from "../sqlite-busy";

export type CachedFrame = {
  id: string;
  provider: DesignProvider;
  name: string;
  width: number | null;
  height: number | null;
  mime: FrameMime;
  path: string;
  version: string | null;
  fetchedAt: number;
  usedAt: number;
  bytes: number;
};
export type FramePut = Omit<CachedFrame, "path" | "usedAt" | "bytes"> & { body: Uint8Array };
export type FrameCache = {
  get(id: string): CachedFrame | null;
  put(input: FramePut): CachedFrame;
  touch(id: string, fetchedAt: number | null): void;
  remove(id: string): void;
  purge(): number;
  totalBytes(): number;
};
export type FrameCacheDeps = {
  db: Database;
  home: string;
  now(): number;
  maxBytes?: number;
  maxTotal?: number;
  idleMs?: number;
};

type Row = {
  frame_id: string;
  provider: string;
  name: string;
  width: number | null;
  height: number | null;
  mime: string;
  path: string;
  version: string | null;
  fetched_at: number;
  used_at: number;
  bytes: number;
};

const rowToFrame = (r: Row): CachedFrame => ({
  id: r.frame_id,
  provider: DesignProvider.parse(r.provider),
  name: r.name,
  width: r.width,
  height: r.height,
  mime: FrameMime.parse(r.mime),
  path: r.path,
  version: r.version,
  fetchedAt: r.fetched_at,
  usedAt: r.used_at,
  bytes: r.bytes,
});
const hashOf = (id: string) => new Bun.CryptoHasher("sha256").update(id).digest("hex");

function frameQueries(db: Database) {
  return {
    select: db.query<Row, { id: string }>("SELECT * FROM design_cache WHERE frame_id = $id"),
    upsert: db.query<null, Row>(
      "INSERT INTO design_cache (frame_id, provider, name, width, height, mime, path, version, fetched_at, used_at, bytes) VALUES ($frame_id, $provider, $name, $width, $height, $mime, $path, $version, $fetched_at, $used_at, $bytes) ON CONFLICT(frame_id) DO UPDATE SET provider = excluded.provider, name = excluded.name, width = excluded.width, height = excluded.height, mime = excluded.mime, path = excluded.path, version = excluded.version, fetched_at = excluded.fetched_at, used_at = excluded.used_at, bytes = excluded.bytes",
    ),
    del: db.query<null, { id: string }>("DELETE FROM design_cache WHERE frame_id = $id"),
    used: db.query<null, { id: string; now: number }>(
      "UPDATE design_cache SET used_at = $now WHERE frame_id = $id",
    ),
    fetched: db.query<null, { id: string; now: number; at: number }>(
      "UPDATE design_cache SET used_at = $now, fetched_at = $at WHERE frame_id = $id",
    ),
    total: db.query<{ n: number | null }, []>("SELECT sum(bytes) AS n FROM design_cache"),
    oldest: db.query<Row, []>("SELECT * FROM design_cache ORDER BY used_at ASC LIMIT 1"),
    idle: db.query<Row, { before: number }>("SELECT * FROM design_cache WHERE used_at < $before"),
  };
}

export function createFrameCache(deps: FrameCacheDeps): FrameCache {
  const { db } = deps;
  const maxBytes = deps.maxBytes ?? MAX_DESIGN_FRAME_BYTES;
  const maxTotal = deps.maxTotal ?? MAX_DESIGN_CACHE_BYTES;
  const idleMs = deps.idleMs ?? DESIGN_CACHE_IDLE_MS;
  const dir = join(deps.home, "cache", "design");
  rmSync(join(deps.home, "cache", "figma"), { recursive: true, force: true });
  const q = frameQueries(db);
  const drop = (row: Row) => {
    q.del.run({ id: row.frame_id });
    rmSync(row.path, { force: true });
  };
  const totalBytes = () => q.total.get()?.n ?? 0;
  const evict = () => {
    while (totalBytes() > maxTotal) {
      const row = q.oldest.get();
      if (!row) return;
      drop(row);
    }
  };
  const write = (input: FramePut): string => {
    const path = join(dir, `${hashOf(input.id)}.${frameExtension(input.mime)}`);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    chmodSync(dir, 0o700);
    writeFileSync(path, input.body, { mode: 0o600 });
    chmodSync(path, 0o600);
    return path;
  };

  return {
    get(id) {
      const row = q.select.get({ id });
      if (!row) return null;
      if (!existsSync(row.path)) {
        q.del.run({ id });
        return null;
      }
      const now = deps.now();
      q.used.run({ id, now });
      return rowToFrame({ ...row, used_at: now });
    },
    put(input) {
      if (input.body.byteLength > maxBytes)
        throw new KiboError("TOO_LARGE", `frame image exceeds ${maxBytes} bytes`);
      if (sniffImage(input.body) !== input.mime)
        throw new KiboError("INVALID_INPUT", "frame image does not match its mime");
      const previous = q.select.get({ id: input.id });
      const path = write(input);
      if (previous && previous.path !== path) rmSync(previous.path, { force: true });
      const row: Row = {
        frame_id: input.id,
        provider: input.provider,
        name: input.name,
        width: input.width,
        height: input.height,
        mime: input.mime,
        path,
        version: input.version,
        fetched_at: input.fetchedAt,
        used_at: deps.now(),
        bytes: input.body.byteLength,
      };
      immediateTransaction(db, () => {
        q.upsert.run(row);
        evict();
      })();
      return rowToFrame(row);
    },
    touch(id, fetchedAt) {
      const now = deps.now();
      if (fetchedAt === null) q.used.run({ id, now });
      else q.fetched.run({ id, now, at: fetchedAt });
    },
    remove(id) {
      const row = q.select.get({ id });
      if (row) drop(row);
    },
    purge() {
      const rows = q.idle.all({ before: deps.now() - idleMs });
      for (const row of rows) drop(row);
      return rows.length;
    },
    totalBytes,
  };
}
