import { Database } from "bun:sqlite";
import { SQLITE_BUSY_TIMEOUT_MS } from "./sqlite-busy";

export function vacuumFileInto(file: string, path: string): void {
  const reader = new Database(file, { readonly: true, strict: true });
  try {
    reader.exec(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
    reader.run("VACUUM INTO ?", [path]);
  } finally {
    reader.close();
  }
}
