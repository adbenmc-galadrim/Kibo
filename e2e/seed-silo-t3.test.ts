import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createThreadStore } from "../packages/daemon/src/t3/thread-store";
import type { RpcRequest } from "../packages/schema/src/index";
import { createMemoryDaemon, memorySeed } from "./fixtures/memory-daemon";
import { fakeT3Seed, seedSiloT3 } from "./seed-silo-t3";

const TODAY = "2026-10-16";

function setup() {
  const daemon = createMemoryDaemon("adam", TODAY);
  const launched: string[] = [];
  const threads = new Set<string>();
  const log: string[] = [];
  const rpc = async (req: RpcRequest): Promise<unknown> => {
    if (req.method === "t3.launch") {
      launched.push(req.ticketKey);
      threads.add(req.ticketKey);
      return {};
    }
    if (req.method === "t3.threadOf") return threads.has(req.ticketKey) ? {} : null;
    if (req.method === "t3.refresh") {
      log.push("refresh");
      return [];
    }
    return daemon.rpc(req);
  };
  const t3 = {
    nextThread: (id: string) => log.push(`next:${id}`),
    setStatus: (id: string, status: string) => log.push(`status:${id}:${status}`),
    age: (id: string, ms: number) => log.push(`age:${id}:${ms}`),
  };
  return { rpc, launched, log, options: { ...memorySeed(daemon), t3 } };
}

test("SILO-34 runs for 12 minutes and SILO-45 waits for an answer", async () => {
  const s = setup();
  await seedSiloT3(s.rpc, s.options);
  expect(s.launched).toEqual(["SILO-34", "SILO-45"]);
  expect(s.log).toEqual([
    "next:thr_silo34",
    "age:thr_silo34:720000",
    "next:thr_silo45",
    "age:thr_silo45:720000",
    "status:thr_silo45:waiting",
    "refresh",
  ]);
});

test("seeding twice launches nothing more", async () => {
  const s = setup();
  await seedSiloT3(s.rpc, s.options);
  await seedSiloT3(s.rpc, s.options);
  expect(s.launched).toEqual(["SILO-34", "SILO-45"]);
});

test("the seed helper ages a stored thread and edits the fake state", () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-seed-t3-"));
  const dbPath = join(dir, "kibo.db");
  const db = new Database(dbPath, { strict: true });
  const store = createThreadStore(db);
  const thread = {
    threadId: "a",
    link: "",
    title: "a",
    status: "running" as const,
    startedAt: 1_000_000,
    checkedAt: 1,
  };
  store.add("p", "t", thread);
  const statePath = join(dir, "state.json");
  const seed = fakeT3Seed(statePath, dbPath);
  seed.age("a", 720_000);
  expect(store.threadOf("p", "t")?.startedAt).toBe(280_000);
  seed.nextThread("thr_x");
  expect(JSON.parse(readFileSync(statePath, "utf8")).nextId).toBe("thr_x");
  db.close();
  rmSync(dir, { recursive: true, force: true });
});
