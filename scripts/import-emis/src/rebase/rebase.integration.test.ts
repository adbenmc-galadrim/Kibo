import { afterAll, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SETUP_PAGES } from "@kibo/schema";
import { seedEmisShaped } from "../../fixtures/emis-shaped";
import type { SeedClient } from "../daemon-client";
import { applyPlan, requiredDaemonVersion } from "./apply-new";
import { type OldProject, readOldProject } from "./old-project";
import { buildRebasePlan, parsePlan, type RebasePlan, serializePlan } from "./plan-file";
import { QUESTION_PLACEMENT } from "./question-placement";
import { rehearse, startTempDaemon, type TempDaemon } from "./rehearse";
import { renderReport } from "./report";
import { TODO_PLACEMENT } from "./todo-placement";
import { verifyRebase } from "./verify";

const SCRIPT = join(import.meta.dir, "..", "..", "rebase-emis.ts");
const CLIENT = "Client fictif";
const home = mkdtempSync(join(tmpdir(), "kibo-rebase-home-"));
const exportDir = mkdtempSync(join(tmpdir(), "kibo-rebase-export-"));
const VERSION = { version: requiredDaemonVersion() };
let daemon: TempDaemon = await startTempDaemon(home, VERSION);
const state: { old: OldProject | null; plan: RebasePlan | null; newId: string | null } = {
  old: null,
  plan: null,
  newId: null,
};

afterAll(async () => {
  await daemon.stop();
  rmSync(home, { recursive: true, force: true });
  rmSync(exportDir, { recursive: true, force: true });
});

const ready = <T>(value: T | null, what: string): T => {
  if (value === null) throw new Error(`${what} comes from an earlier test`);
  return value;
};
const backups = (c: SeedClient) => c.rpc({ method: "getBackups" }).then((b) => b.backups.length);
const projects = (c: SeedClient) => c.rpc({ method: "listProjects" });

async function seedOld(c: SeedClient): Promise<void> {
  const { projectId } = await seedEmisShaped(c);
  await c.rpc({ method: "updateProject", projectId, patch: { client: CLIENT } });
}

async function dryRun(c: SeedClient, dir: string): Promise<{ old: OldProject; plan: RebasePlan }> {
  const project = (await projects(c)).find((p) => p.key === "EMIS");
  if (!project) throw new Error("no EMIS project");
  const snapshot = await c.rpc({ method: "getProject", projectId: project.id });
  writeFileSync(join(dir, "project-old.json"), JSON.stringify(snapshot));
  const old = readOldProject(snapshot);
  const plan = buildRebasePlan({
    old,
    source: "getProject",
    merges: null,
    placement: TODO_PLACEMENT,
    overrides: QUESTION_PLACEMENT,
  });
  writeFileSync(join(dir, "rebase-report.md"), renderReport(plan));
  writeFileSync(join(dir, "rebase-plan.json"), serializePlan(plan));
  return { old, plan: parsePlan(readFileSync(join(dir, "rebase-plan.json"), "utf8")) };
}

async function expectRebased(c: SeedClient, projectId: string, plan: RebasePlan, old: OldProject) {
  const fresh = await c.rpc({ method: "getProject", projectId });
  expect(fresh.meta).toMatchObject({ key: "EMIS", client: CLIENT });
  expect(fresh.pages.map((p) => p.title)).toEqual(SETUP_PAGES.map((p) => p.title));
  expect(fresh.sprints.map((s) => s.code)).toEqual(
    Array.from({ length: plan.setup.sprintCount }, (_, i) => `S${i + 1}`),
  );
  const features = fresh.tickets.filter((t) => t.parentId === null);
  const steps = fresh.tickets.filter((t) => t.parentId !== null);
  expect(features.map((t) => t.key)).toEqual(Array.from({ length: 15 }, (_, i) => `F${i + 1}`));
  expect(steps.map((t) => t.key).sort((a, b) => Number(a?.slice(5)) - Number(b?.slice(5)))).toEqual(
    Array.from({ length: steps.length }, (_, i) => `EMIS-${i + 1}`),
  );
  expect(features.filter((t) => t.sprintId !== null)).toHaveLength(plan.schedule.length);
  expect(verifyRebase(old, fresh, plan)).toEqual([]);
}

test("seeds the old project, then a dry run writes the report and the plan without touching it", async () => {
  await daemon.withClient(async (c) => {
    await seedOld(c);
    const before = await dryRun(c, exportDir);
    const { old, plan } = await dryRun(c, exportDir);
    expect(old.fingerprint).toBe(before.old.fingerprint);
    expect(await projects(c)).toHaveLength(1);
    expect(readFileSync(join(exportDir, "rebase-report.md"), "utf8")).toContain("Rien à placer.");
    state.old = old;
    state.plan = plan;
  });
}, 60_000);

test("the rehearsal on a temporary daemon finds nothing lost", async () => {
  expect(await rehearse(ready(state.plan, "plan"), ready(state.old, "old"))).toEqual([]);
}, 60_000);

test("applies the plan: backup, old project deleted, new project verified", async () => {
  const plan = ready(state.plan, "plan");
  const old = ready(state.old, "old");
  const backupId = await daemon.withClient(async (c) => {
    const [oldProject] = await projects(c);
    const before = await backups(c);
    const outcome = await applyPlan(c, plan, { exportDir });
    expect(outcome.problems).toEqual([]);
    expect(await backups(c)).toBe(before + 1);
    const after = await projects(c);
    expect(after.map((p) => p.id)).toEqual([outcome.projectId]);
    expect(outcome.projectId).not.toBe(oldProject?.id);
    await expectRebased(c, outcome.projectId, plan, old);
    state.newId = outcome.projectId;
    return outcome.backup.id;
  });
  const result = readFileSync(join(exportDir, "rebase-result.md"), "utf8");
  expect(result).toContain("**Conforme**");
  expect(result).toContain(`- Sauvegarde : ${backupId}`);
}, 60_000);

test("after a restart the new project still has its pages, sprints, client and tickets", async () => {
  const projectId = ready(state.newId, "new project");
  await daemon.stop();
  daemon = await startTempDaemon(home, VERSION);
  await daemon.withClient((c) =>
    expectRebased(c, projectId, ready(state.plan, "plan"), ready(state.old, "old")),
  );
}, 60_000);

test("replaying the same plan is refused on its fingerprint, before any write", async () => {
  const plan = ready(state.plan, "plan");
  await daemon.withClient(async (c) => {
    const before = { backups: await backups(c), projects: await projects(c) };
    await expect(applyPlan(c, plan, { exportDir })).rejects.toThrow("fingerprint");
    const out = mkdtempSync(join(tmpdir(), "kibo-rebase-replay-"));
    try {
      const proc = Bun.spawn(
        ["bun", SCRIPT, "--apply", "--plan", join(exportDir, "rebase-plan.json"), "--yes"].concat([
          "--home",
          home,
          "--export",
          out,
          "--no-gh",
        ]),
        { env: { ...process.env, KIBO_HOME: home }, stdin: "ignore", stdout: "pipe", stderr: "pipe" },
      );
      const [code, err] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
      expect(code).toBe(1);
      expect(err).toContain("fingerprint");
      expect(existsSync(join(out, "rebase-result.md"))).toBe(false);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
    expect(await backups(c)).toBe(before.backups);
    expect(await projects(c)).toEqual(before.projects);
  });
}, 60_000);

test("a plan edited by hand stops at the key check and keeps the new project", async () => {
  const dir = mkdtempSync(join(tmpdir(), "kibo-rebase-edited-"));
  try {
    await daemon.withClient(async (c) => {
      await c.rpc({ method: "deleteProject", projectId: ready(state.newId, "new project") });
      await seedOld(c);
      const { plan } = await dryRun(c, dir);
      const firstStep = plan.commands.findIndex((p) => p.op === "command" && p.expectKey === "EMIS-1");
      const edited: RebasePlan = {
        ...plan,
        commands: plan.commands.map((p, i) =>
          i === firstStep && p.op === "command" ? { ...p, expectKey: "EMIS-2" } : p,
        ),
      };
      await expect(applyPlan(c, edited, { exportDir: dir })).rejects.toThrow("key check");
      const kept = await projects(c);
      expect(kept.map((p) => p.key)).toEqual(["EMIS"]);
      const partial = await c.rpc({ method: "getProject", projectId: kept[0]?.id ?? "" });
      expect(partial.tickets.map((t) => t.key)).toEqual(["F1", "EMIS-1"]);
    });
    const result = readFileSync(join(dir, "rebase-result.md"), "utf8");
    expect(result).toContain("**Arrêt à la vérification des clés**");
    expect(result).toContain("predicted EMIS-2, daemon gave EMIS-1");
    expect(result).toContain("est conservé");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}, 60_000);

test("a daemon older than the build is refused before any write", async () => {
  const oldHome = mkdtempSync(join(tmpdir(), "kibo-rebase-old-daemon-"));
  const out = mkdtempSync(join(tmpdir(), "kibo-rebase-old-export-"));
  const stale = await startTempDaemon(oldHome, { version: "0.26.0-alpha.2" });
  try {
    await stale.withClient(async (c) => {
      await seedOld(c);
      const { plan } = await dryRun(c, out);
      const before = { backups: await backups(c), projects: await projects(c) };
      await expect(applyPlan(c, plan, { exportDir: out })).rejects.toThrow(
        `démon trop ancien (0.26.0-alpha.2) : redémarre Kibo sur la version ${requiredDaemonVersion()}`,
      );
      expect(await backups(c)).toBe(before.backups);
      expect(await projects(c)).toEqual(before.projects);
      expect(existsSync(join(out, "rebase-result.md"))).toBe(false);
    });
  } finally {
    await stale.stop();
    rmSync(oldHome, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
}, 60_000);
