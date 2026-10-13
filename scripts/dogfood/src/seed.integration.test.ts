import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DOMAIN_COLORS, Domain, Ticket } from "@kibo/schema";
import type { Subprocess } from "bun";
import { connectLocalDaemon, readDaemonAccess, type SeedClient } from "./daemon-client";
import { resolveOwner } from "./desired";
import { type Desired, loadDesired } from "./load";
import { seedKibo } from "./seed";

const REPO = join(import.meta.dir, "..", "..", "..");
const MAIN = join(REPO, "packages", "daemon", "src", "main.ts");
const ISOLATED_SECRETS = ["--memory-secrets", "--test-origins", "api.github.com=http://127.0.0.1:9"];
let home = "";
let folder = "";
let daemon: Subprocess<"ignore", "pipe", "ignore"> | null = null;
const extraHomes: string[] = [];

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

async function startDaemon(kiboHome: string): Promise<Subprocess<"ignore", "pipe", "ignore">> {
  const proc = Bun.spawn(["bun", MAIN, "--port", "0", ...ISOLATED_SECRETS], {
    env: { ...process.env, KIBO_HOME: kiboHome },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "ignore",
  });
  await waitReady(proc);
  return proc;
}

async function stopDaemon(proc: Subprocess<"ignore", "pipe", "ignore"> | null): Promise<void> {
  proc?.kill("SIGTERM");
  await proc?.exited;
}

beforeAll(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-dogfood-home-"));
  folder = mkdtempSync(join(tmpdir(), "kibo-dogfood-folder-"));
  mkdirSync(join(folder, "docs"));
  daemon = await startDaemon(home);
}, 30_000);

afterAll(async () => {
  await stopDaemon(daemon);
  for (const dir of [home, folder, ...extraHomes]) rmSync(dir, { recursive: true, force: true });
});

async function withClient<T>(run: (c: SeedClient) => Promise<T>, kiboHome = home): Promise<T> {
  const client = await connectLocalDaemon(readDaemonAccess(kiboHome));
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

async function seedWorkspaceDomains(c: SeedClient, desired: Desired): Promise<void> {
  const project = await c.rpc({ method: "createProject", ...desired.project });
  const ids = new Map<string, string>();
  for (const [i, d] of desired.domains.entries()) {
    const color = DOMAIN_COLORS[i % DOMAIN_COLORS.length] ?? DOMAIN_COLORS[0];
    const created = Domain.parse(
      await c.rpc({ method: "config", command: { method: "createDomain", domain: { name: d.name, color } } }),
    );
    ids.set(d.name, created.id);
  }
  for (const g of desired.guidelines) {
    const owner = resolveOwner(g.owner, {
      projectId: project.id,
      domains: ids,
      workspaceDomains: new Set(ids.values()),
    });
    if (owner)
      await c.rpc({
        method: "config",
        command: { method: "addGuideline", owner, path: g.path, content: g.content },
      });
  }
  for (const t of desired.tickets) {
    const ticket = Ticket.parse(
      await c.rpc({
        method: "command",
        projectId: project.id,
        command: { method: "createTicket", title: t.title, description: t.description },
      }),
    );
    const domainId = t.domain === null ? null : (ids.get(t.domain) ?? null);
    if (domainId !== null)
      await c.rpc({
        method: "command",
        projectId: project.id,
        command: { method: "updateTicket", ticketId: ticket.id, domainId },
      });
  }
}

test("replayed on an instance with the Kibo domains in the workspace, it creates none in the project", async () => {
  const legacy = mkdtempSync(join(tmpdir(), "kibo-dogfood-legacy-"));
  extraHomes.push(legacy);
  const desired = loadDesired(REPO, folder);
  const proc = await startDaemon(legacy);
  try {
    await withClient((c) => seedWorkspaceDomains(c, desired), legacy);
    const report = await withClient((c) => seedKibo(c, desired), legacy);
    expect(report.created).toMatchObject({ project: 0, domain: 0, guideline: 0, ticket: 0, ticketDomain: 0 });
    const config = await withClient((c) => c.rpc({ method: "getConfig" }), legacy);
    expect(config.domains.map((d) => d.owner.scope)).toEqual(desired.domains.map(() => "workspace"));
  } finally {
    await stopDaemon(proc);
  }
}, 90_000);
