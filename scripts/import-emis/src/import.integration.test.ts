import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Subprocess } from "bun";
import { applyDesired } from "./apply";
import { connectLocalDaemon, readDaemonAccess, type SeedClient } from "./daemon-client";
import { PAGES } from "./desired";
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

async function daemonStoresLabels(): Promise<boolean> {
  return withClient(async (c) => {
    const probe = await c.rpc({
      method: "createProject",
      name: "Sonde",
      key: "SONDE",
      folder: null,
      color: "#64748B",
    });
    await c.rpc({
      method: "command",
      projectId: probe.id,
      command: { method: "createTicket", title: "x", labels: ["x"] },
    });
    const snap = await c.rpc({ method: "getProject", projectId: probe.id });
    await c.rpc({ method: "deleteProject", projectId: probe.id });
    return snap.tickets.some((t) => t.labels.includes("x"));
  });
}
const LABELS_STORED = await daemonStoresLabels();

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

test.skipIf(!LABELS_STORED)(
  "imports the fixture once, then finds everything, then repairs a missing import ref",
  async () => {
    const folder = join(home, "emis");
    mkdirSync(folder, { recursive: true });
    const notes = join(home, "notes");
    const desired = fixtureDesired(notes);
    const options = { folder, notesDir: notes, dryRun: false, manifestVersions: VERSIONS };
    const first = await withClient((c) => applyDesired(c, desired, options));
    expect(first.counts).toMatchObject({ updated: 0, orphan: 0, drift: 0 });
    expect(first.counts.created).toBe(
      desired.tickets.length + desired.links.length + desired.notes.length + 4 + 1 + 2 + 1 + 1,
    );
    const second = await withClient((c) => applyDesired(c, desired, options));
    expect(second.counts.lines).toEqual([]);

    const projectId = first.projectId ?? "";
    const snap = await withClient((c) => c.rpc({ method: "getProject", projectId }));
    expect(snap.meta).toMatchObject({ name: "Emis", key: "EMIS", folder });
    expect(snap.pages.map((p) => p.title)).toEqual(["Tableau de bord", "Plan", "Graphe", "Notes"]);
    expect(snap.instances).toHaveLength(5);
    const c12 = snap.tickets.find((t) => t.title.startsWith("C1-2 · "));
    expect(c12).toMatchObject({
      statusId: "todo",
      labels: ["area:api", "area:web", "phase:p1", "sprint:s2"],
    });
    expect(c12?.externalRefs).toContainEqual({
      kind: "git_branch",
      branch: "feat/connexion",
      base: "spike/sso",
    });
    expect(snap.links.filter((l) => l.type === "blocks")).toHaveLength(8);
    expect(snap.tickets.filter((t) => t.statusId === "blocked")).toHaveLength(2);
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
          ticketId: c12?.id ?? "",
          kind: "import_ref",
          key: "plan:C1-2",
        },
      }),
    );
    const third = await withClient((c) => applyDesired(c, desired, options));
    expect(third.counts).toMatchObject({ created: 0, updated: 1 });
    expect(third.changes).toContainEqual({ kind: "updated", what: "ticket C1-2", detail: "import_ref" });
  },
  60_000,
);
