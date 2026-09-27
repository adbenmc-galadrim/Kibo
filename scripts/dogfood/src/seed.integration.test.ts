import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { connectLocalDaemon, readDaemonAccess, type SeedClient } from "./daemon-client";
import { loadDesired } from "./load";
import { seedKibo } from "./seed";

const REPO = join(import.meta.dir, "..", "..", "..");
const MAIN = join(REPO, "packages", "daemon", "src", "main.ts");
const ISOLATED_SECRETS = ["--memory-secrets", "--test-origins", "api.github.com=http://127.0.0.1:9"];
let home = "";
let folder = "";
let daemon: Subprocess<"ignore", "pipe", "ignore"> | null = null;

async function waitReady(proc: Subprocess<"ignore", "pipe", "ignore">): Promise<void> {
  const reader = proc.stdout.getReader();
  let out = "";
  while (!out.includes("KIBO_READY")) {
    const { value, done } = await reader.read();
    if (done) throw new Error("daemon exited before being ready");
    out += new TextDecoder().decode(value);
  }
  reader.releaseLock();
}

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-dogfood-home-"));
  folder = mkdtempSync(join(tmpdir(), "kibo-dogfood-folder-"));
  mkdirSync(join(folder, "docs"));
  daemon = Bun.spawn(["bun", MAIN, "--port", "0", ...ISOLATED_SECRETS], {
    env: { ...process.env, KIBO_HOME: home },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  await waitReady(daemon);
}, 30_000);

afterAll(async () => {
  daemon?.kill("SIGTERM");
  await daemon?.exited;
  rmSync(home, { recursive: true, force: true });
  rmSync(folder, { recursive: true, force: true });
});

async function withClient<T>(run: (c: SeedClient) => Promise<T>): Promise<T> {
  const client = await connectLocalDaemon(readDaemonAccess(home));
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

test("seeds the Kibo project once, then finds everything on a second run", async () => {
  const desired = loadDesired(REPO, folder);
  const first = await withClient((c) => seedKibo(c, desired));
  expect(first.created).toMatchObject({
    project: 1,
    domain: desired.domains.length,
    profile: 4,
    guideline: desired.guidelines.length,
    page: desired.pages.length,
    instance: desired.pages.reduce((n, p) => n + p.instances.length, 0),
    ticket: desired.tickets.length,
    notesDir: 1,
  });

  const second = await withClient((c) => seedKibo(c, desired));
  expect(Object.values(second.created).every((n) => n === 0)).toBe(true);
  expect(second.kept).toMatchObject({ project: 1, ticket: desired.tickets.length, notesDir: 1 });

  const state = await withClient(async (c) => ({
    project: await c.rpc({ method: "getProject", projectId: first.projectId }),
    notes: await c.rpc({ method: "getNotesDir", projectId: first.projectId }),
    sessions: await c.rpc({ method: "listSessions" }),
  }));
  expect(state.project.meta).toMatchObject({ name: "Kibo", key: "KIB", folder });
  expect(state.project.tickets.filter((t) => t.domainId !== null)).toHaveLength(
    desired.tickets.filter((t) => t.domain !== null).length,
  );
  expect(state.notes.dir).toBe(join(folder, "docs"));
  expect(state.sessions).toHaveLength(1);
}, 60_000);
