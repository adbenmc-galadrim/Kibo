import type { Database } from "bun:sqlite";

export function tableExists(db: Database, table: string): boolean {
  return (
    db.query("SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = $table").get({ table }) !==
    null
  );
}

export function dropTables(db: Database, tables: readonly string[]): string[] {
  const present = tables.filter((table) => tableExists(db, table));
  for (const table of tables) db.exec(`DROP TABLE IF EXISTS "${table}"`);
  return present;
}
