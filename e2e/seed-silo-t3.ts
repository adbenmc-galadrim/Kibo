import { Database } from "bun:sqlite";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { seedSiloAttente } from "./seed-silo-attente";
import type { SeedOptions, SeedResult, SeedRpc } from "./seed-silo-maquettes";

const RUNNING_FOR_MS = 12 * 60_000;
const SILO_THREADS = [
  { key: "SILO-34", threadId: "thr_silo34" },
  { key: "SILO-45", threadId: "thr_silo45" },
];
const WAITING_THREAD = "thr_silo45";

export type SeedT3 = {
  nextThread(threadId: string): void;
  setStatus(threadId: string, status: string): void;
  age(threadId: string, ms: number): void;
};

type FakeState = { mode: string; threads: { threadId: string; status: string }[]; nextId: string };

export function fakeT3Seed(statePath: string, dbPath: string): SeedT3 {
  const read = (): FakeState =>
    existsSync(statePath)
      ? JSON.parse(readFileSync(statePath, "utf8"))
      : { mode: "ok", threads: [], nextId: "thr_1" };
  const write = (state: FakeState) => writeFileSync(statePath, JSON.stringify(state));
  return {
    nextThread: (threadId) => write({ ...read(), nextId: threadId }),
    setStatus(threadId, status) {
      const state = read();
      write({
        ...state,
        threads: state.threads.map((t) => (t.threadId === threadId ? { ...t, status } : t)),
      });
    },
    age(threadId, ms) {
      const db = new Database(dbPath);
      db.exec("PRAGMA busy_timeout = 5000");
      db.query(
        "UPDATE ticket_threads SET started_at = started_at - ?1, changed_at = changed_at - ?1 WHERE thread_id = ?2",
      ).run(ms, threadId);
      db.close();
    },
  };
}

export async function seedSiloT3(rpc: SeedRpc, options: SeedOptions & { t3: SeedT3 }): Promise<SeedResult> {
  const result = await seedSiloAttente(rpc, options);
  const { projectId } = result;
  let launched = false;
  for (const { key, threadId } of SILO_THREADS) {
    if ((await rpc({ method: "t3.threadOf", projectId, ticketKey: key })) !== null) continue;
    options.t3.nextThread(threadId);
    await rpc({ method: "t3.launch", projectId, ticketKey: key });
    options.t3.age(threadId, RUNNING_FOR_MS);
    launched = true;
  }
  if (launched) {
    options.t3.setStatus(WAITING_THREAD, "waiting");
    await rpc({ method: "t3.refresh", projectId });
  }
  return result;
}
