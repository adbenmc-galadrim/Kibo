import { Database } from "bun:sqlite";
import { chmodSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { SQLITE_BUSY_TIMEOUT_MS } from "../sqlite-busy";

export function openRunsDatabase(home: string, what: string): Database {
  mkdirSync(home, { recursive: true, mode: 0o700 });
  const file = join(home, "runs.db");
  try {
    const db = new Database(file, { create: true, strict: true });
    db.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA synchronous = FULL");
    for (const f of [file, `${file}-wal`, `${file}-shm`]) if (existsSync(f)) chmodSync(f, 0o600);
    return db;
  } catch (e) {
    throw new KiboError("STORE_CORRUPT", `cannot open the ${what} tables in ${file}: ${String(e)}`);
  }
}
