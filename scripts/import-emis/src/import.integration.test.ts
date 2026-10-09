import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type ProjectCommand, Ticket } from "@kibo/schema";
import type { Subprocess } from "bun";
import { applyDesired } from "./apply";
import { connectLocalDaemon, readDaemonAccess, type SeedClient } from "./daemon-client";
import { PAGES } from "./desired";
import { loadMemory } from "./import-memory";
import { builtinVersions } from "./kibo-components";
import { fixtureDesired } from "./reconcile.test-kit";

const REPO = join(import.meta.dir, "..", "..", "..");
const MAIN = join(REPO, "packages", "daemon", "src", "main.ts");
const VERSIONS = builtinVersions(PAGES);
const ISOLATED = ["--memory-secrets", "--test-origins", "api.github.com=http://127.0.0.1:9"];

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

const home = mkdtempSync(join(tmpdir(), "kibo-import-emis-home-"));
const daemon = Bun.spawn(["bun", MAIN, "--port", "0", ...ISOLATED], {
  env: { ...process.env, KIBO_HOME: home },
  stdin: "ignore",
  stdout: "pipe",
  stderr: "ignore",
});
await waitReady(daemon);

afterAll(async () => {
  daemon.kill("SIGTERM");
  await daemon.exited;
  rmSync(home, { recursive: true, force: true });
});

async function withClient<T>(run: (c: SeedClient) => Promise<T>): Promise<T> {
  const client = await connectLocalDaemon(readDaemonAccess(home));
  try {
    return await run(client);
  } finally {
    await client.close();
  }
}

test("a dry run writes nothing", async () => {
  const folder = join(home, "dry", "emis");
  mkdirSync(folder, { recursive: true });
  const notes = join(home, "dry", "notes");
  const desired = fixtureDesired(notes);
  const lines: string[] = [];
  const dry = await withClient((c) =>
    applyDesired(c, desired, {
      folder,
      notesDir: notes,
      dryRun: true,
      manifestVersions: VERSIONS,
      print: (l) => lines.push(l),
    }),
  );
  expect(dry.projectId).toBeNull();
  expect(dry.counts.created).toBeGreaterThan(desired.tickets.length);
  expect(lines.some((l) => l.includes('"method":"createTicket"'))).toBe(true);
  expect(existsSync(notes)).toBe(false);
  expect(await withClient((c) => c.rpc({ method: "listProjects" }))).toEqual([]);
}, 60_000);

test("imports the fixture once, then finds everything, then repairs a missing import ref", async () => {
  const folder = join(home, "emis");
  mkdirSync(folder, { recursive: true });
  const notes = join(home, "notes");
  const desired = fixtureDesired(notes);
  const options = { folder, notesDir: notes, dryRun: false, manifestVersions: VERSIONS };
  const first = await withClient((c) => applyDesired(c, desired, options));
  expect(first.counts).toMatchObject({ updated: 0, orphan: 0, drift: 0 });
  expect(first.counts.created).toBe(
    desired.tickets.length +
      desired.links.length +
      desired.questions.length +
      desired.notes.length +
      4 +
      1 +
      2 +
      1 +
      1,
  );
  const second = await withClient((c) => applyDesired(c, desired, options));
  expect(second.counts.lines).toEqual([]);

  const projectId = first.projectId;
  if (projectId === null) throw new Error("the import creates the project");
  const snap = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  expect(snap.meta).toMatchObject({ name: "Emis", key: "EMIS", folder });
  expect(snap.pages.map((p) => p.title)).toEqual(["Tableau de bord", "Plan", "Graphe", "Notes"]);
  expect(snap.instances).toHaveLength(5);
  const graphs = snap.instances.filter((i) => i.component.startsWith("graph@"));
  expect(graphs.map((i) => i.config)).toEqual([{ filter: "all" }, { filter: "all" }]);
  const c12 = snap.tickets.find((t) => t.title.startsWith("C1-2 · "));
  if (!c12) throw new Error("the import creates C1-2");
  expect(c12).toMatchObject({
    statusId: "todo",
    labels: ["area:api", "area:web", "phase:p1", "sprint:s2"],
  });
  expect(c12.externalRefs).toContainEqual({
    kind: "git_branch",
    branch: "feat/connexion",
    base: "spike/sso",
  });
  expect(snap.links.filter((l) => l.type === "blocks")).toHaveLength(6);
  expect(snap.tickets.filter((t) => t.statusId === "blocked").map((t) => t.title)).toEqual([
    "C0-3 · Hébergement",
  ]);
  expect(snap.tickets.filter((t) => /^Q\d+ · /.test(t.title))).toEqual([]);
  expect(
    snap.questions
      .map((q) => [q.importRef?.id ?? "", q.blocking, q.createdBy.kind, q.answer?.text ?? null] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  ).toEqual([
    ["Q1", true, "import", null],
    ["Q2", true, "import", "Résolue dans le plan Emis"],
    ["Q3", true, "import", "Oui, un seul bouton."],
  ]);
  expect(snap.questions.find((q) => q.importRef?.id === "Q3")?.answer?.deliveredAt).toBeNull();
  const c02 = snap.tickets.find((t) => t.title.startsWith("C0-2 · "));
  expect(readFileSync(join(notes, "briefs", "C0-2.md"), "utf8")).toContain(`tickets: [${c02?.key}]`);
  const config = await withClient((c) => c.rpc({ method: "getConfig" }));
  expect(config.profiles.find((p) => p.name === "emis-livraison")).toMatchObject({
    permissionMode: "auto",
  });
  expect(await withClient((c) => c.rpc({ method: "getNotesDir", projectId }))).toMatchObject({
    dir: notes,
  });

  await withClient((c) =>
    c.rpc({
      method: "command",
      projectId,
      command: {
        method: "removeExternalRef",
        ticketId: c12.id,
        kind: "import_ref",
        key: "plan:C1-2",
      },
    }),
  );
  const third = await withClient((c) => applyDesired(c, desired, options));
  expect(third.counts).toMatchObject({ created: 0, updated: 1 });
  expect(third.changes).toContainEqual({ kind: "updated", what: "ticket C1-2", detail: "import_ref" });
}, 60_000);

test("an instance left with an empty config gets the wanted config; a configured one is kept", async () => {
  const projectId = (await withClient((c) => c.rpc({ method: "listProjects" }))).find(
    (p) => p.name === "Emis",
  )?.id;
  if (!projectId) throw new Error("the previous test imports Emis");
  const notes = join(home, "notes");
  const options = { folder: join(home, "emis"), notesDir: notes, dryRun: false, manifestVersions: VERSIONS };
  const before = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  const graphOn = (title: string) => {
    const page = before.pages.find((p) => p.title === title);
    const instance = before.instances.find((i) => i.pageId === page?.id && i.component.startsWith("graph@"));
    if (!instance) throw new Error(`no graph instance on ${title}`);
    return instance.id;
  };
  const dashboardGraph = graphOn("Tableau de bord");
  const viewGraph = graphOn("Graphe");
  const setConfig = (instanceId: string, config: Record<string, unknown>) =>
    withClient((c) =>
      c.rpc({ method: "command", projectId, command: { method: "setInstanceConfig", instanceId, config } }),
    );
  await setConfig(dashboardGraph, {});
  await setConfig(viewGraph, { filter: "mine-and-agents", hideDone: true });
  const run = await withClient((c) => applyDesired(c, fixtureDesired(notes), options));
  expect(run.counts).toMatchObject({ created: 0, updated: 1 });
  expect(run.changes).toContainEqual({ kind: "updated", what: "page Tableau de bord", detail: "config" });
  const after = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  const config = (id: string) => after.instances.find((i) => i.id === id)?.config;
  expect(config(dashboardGraph)).toEqual({ filter: "all" });
  expect(config(viewGraph)).toEqual({ filter: "mine-and-agents", hideDone: true });
}, 60_000);

test("the old question sub-tickets are migrated once: answer kept, links removed, tickets deleted", async () => {
  const projectId = (await withClient((c) => c.rpc({ method: "listProjects" }))).find(
    (p) => p.name === "Emis",
  )?.id;
  if (!projectId) throw new Error("the first import creates Emis");
  const notes = join(home, "notes");
  const options = { folder: join(home, "emis"), notesDir: notes, manifestVersions: VERSIONS };
  const before = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  const ticketOf = (id: string) =>
    before.tickets.find((t) => t.externalRefs.some((r) => r.kind === "import_ref" && r.id === id))?.id ?? "";
  const q1 = before.questions.find((q) => q.importRef?.id === "Q1")?.id ?? "";
  const send = (command: ProjectCommand) =>
    withClient((c) => c.rpc({ method: "command", projectId, command }));
  await send({ method: "removeQuestion", questionId: q1 });
  const group = Ticket.parse(
    await send({ method: "createTicket", title: "Client — bloquants", parentId: ticketOf("arbitrages") }),
  );
  const legacy = Ticket.parse(
    await send({
      method: "createTicket",
      title: "Q1 · Compte AWS au nom du client. Estelle.",
      description: "**Compte AWS** au nom du client. Estelle.\n\n## Réponse\n\nCompte créé le 7.\n",
      statusId: "blocked",
      blockedReason: "Attend une réponse (Client — bloquants)",
      parentId: group.id,
    }),
  );
  const importRef = (ticketId: string, id: string) =>
    send({ method: "upsertExternalRef", ticketId, ref: { kind: "import_ref", source: "plan", id } });
  await importRef(group.id, "arbitrages/client-bloquants");
  await importRef(legacy.id, "Q1");
  await send({ method: "addLink", from: legacy.id, to: ticketOf("C0-3"), type: "blocks" });

  const lines: string[] = [];
  const dry = await withClient((c) =>
    applyDesired(c, fixtureDesired(notes), { ...options, dryRun: true, print: (l) => lines.push(l) }),
  );
  expect(dry.counts.migrated).toBe(2);
  expect(lines.filter((l) => l.startsWith("would delete ticket"))).toHaveLength(2);
  const untouched = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  expect(untouched.tickets.some((t) => t.id === legacy.id)).toBe(true);

  const run = await withClient((c) => applyDesired(c, fixtureDesired(notes), { ...options, dryRun: false }));
  expect(run.counts).toMatchObject({ migrated: 2, orphan: 0, drift: 0 });
  expect(run.changes).toContainEqual(expect.objectContaining({ kind: "created", what: "question Q1" }));
  const after = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  expect(after.tickets.some((t) => t.id === legacy.id || t.id === group.id)).toBe(false);
  expect(after.links.some((l) => l.from === legacy.id)).toBe(false);
  const migrated = after.questions.find((q) => q.importRef?.id === "Q1");
  expect(migrated).toMatchObject({ ticketId: ticketOf("C0-3"), blocking: true });
  expect(migrated?.answer).toMatchObject({ text: "Compte créé le 7.", deliveredAt: null });
  expect(after.tickets.find((t) => t.id === ticketOf("C0-3"))?.statusId).toBe("blocked");

  const again = await withClient((c) =>
    applyDesired(c, fixtureDesired(notes), { ...options, dryRun: false }),
  );
  expect(again.counts).toMatchObject({ created: 0, updated: 0, migrated: 0 });
  expect(again.counts.lines).toEqual([]);
}, 60_000);

test("a status moved in Kibo survives a reimport; a plan change on an untouched field still applies", async () => {
  const projectId = (await withClient((c) => c.rpc({ method: "listProjects" }))).find(
    (p) => p.name === "Emis",
  )?.id;
  if (!projectId) throw new Error("the first import creates Emis");
  const notes = join(home, "notes");
  const options = { folder: join(home, "emis"), notesDir: notes, manifestVersions: VERSIONS, dryRun: false };
  expect(loadMemory(notes)["plan:C1-2"]?.status.statusId).toBe("todo");
  const before = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  const c12 = before.tickets.find((t) => t.title.startsWith("C1-2 · "));
  if (!c12) throw new Error("the import creates C1-2");
  await withClient((c) =>
    c.rpc({
      method: "command",
      projectId,
      command: { method: "setStatus", ticketId: c12.id, statusId: "in_review" },
    }),
  );
  const plan = fixtureDesired(notes);
  const revised = {
    ...plan,
    tickets: plan.tickets.map((t) =>
      t.ref.id === "C1-2" ? { ...t, description: `${t.description}Revu.\n` } : t,
    ),
  };
  const run = await withClient((c) => applyDesired(c, revised, options));
  expect(run.changes).toContainEqual({
    kind: "updated",
    what: "ticket C1-2",
    detail: "description; status (Kibo)",
  });
  const after = await withClient((c) => c.rpc({ method: "getProject", projectId }));
  const kept = after.tickets.find((t) => t.id === c12.id);
  expect(kept?.statusId).toBe("in_review");
  expect(kept?.description.endsWith("Revu.\n")).toBe(true);
  const again = await withClient((c) => applyDesired(c, revised, options));
  expect(again.counts).toMatchObject({ created: 0, updated: 0 });
}, 60_000);
