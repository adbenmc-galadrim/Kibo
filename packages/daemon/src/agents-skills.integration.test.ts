import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Agent, AgentsState, FileVersion, RunView, SaveResult, SkillReview } from "@kibo/schema";
import {
  type AgentList,
  assignAndFinish,
  type Kit,
  readyKiboDev,
  remoteClient,
  type Seeded,
  seedProject,
  startKit,
  stopKits,
  waitFor,
} from "./agents-skills.test-helper";

afterEach(stopKits);

import { FIXTURE_HOME_021 } from "./testing/make-home-0.21";

async function _reviewedRun(kit: Kit, s: Seeded): Promise<RunView> {
  await readyKiboDev(kit, s);
  const run = await assignAndFinish(kit, s, "KIB-14", s.ref("kibo-dev"));
  await waitFor(async () => {
    const reviews = await kit.rpc<SkillReview[]>({ method: "skillReviews.list", runId: run.id });
    return reviews.length === 2 ? reviews : undefined;
  });
  return run;
}

const isTopic = (topic: string) => (e: unknown) =>
  typeof e === "object" && e !== null && Reflect.get(e, "topic") === topic;

test("startup migrates 0.21 profiles into agent files and rewrites runs", async () => {
  const kit = await startKit({ fixture: FIXTURE_HOME_021 });
  const listed = await kit.rpc<AgentList>({ method: "agents.list" });
  const names = listed.agents.map((a) => a.name);
  expect(names).toEqual(
    expect.arrayContaining(["kibo-assistant", "kibo-generateur", "kibo-demo", "kibo-project-agent"]),
  );
  expect(listed.agents.filter((a) => a.scope === "global").length).toBe(3);
  for (const agent of listed.agents) {
    expect(agent.path.startsWith(kit.claude)).toBe(true);
    expect(agent.path.startsWith(join(homedir(), ".claude"))).toBe(false);
  }
  const runs = (await kit.rpc<AgentsState>({ method: "getAgents" })).runs;
  expect(runs.length).toBeGreaterThan(0);
  for (const run of runs) expect(run.profileId).toMatch(/^(global|system):/);
  const files = listed.agents.map((a) => [a.ref, a.hash]);
  await kit.restart();
  const again = await kit.rpc<AgentList>({ method: "agents.list" });
  expect(again.agents.map((a) => [a.ref, a.hash])).toEqual(files);
}, 60_000);

test("a file edited by hand between read and save is never overwritten", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  const names = async (projectId?: string) =>
    (await kit.rpc<AgentList>({ method: "agents.list", projectId })).agents.map((a) => a.name);
  expect(await names(s.project.id)).toEqual(expect.arrayContaining(["kibo-dev", "review", "kibo-demo"]));
  expect(await names()).toEqual(expect.arrayContaining(["kibo-dev", "kibo-assistant"]));
  const elsewhere = await names("0b9d4c2e-1a3f-4e5d-8c7b-6a5f4e3d2c1b");
  expect(elsewhere).toContain("kibo-demo");
  expect(elsewhere).not.toContain("kibo-dev");
  const ref = s.ref("kibo-dev");
  const agent = await kit.rpc<Agent>({ method: "agents.read", ref });
  expect(agent.activeRuns).toBe(0);
  expect(agent.hash).toMatch(/^[0-9a-f]{64}$/);
  const settled = await kit.rpc<Agent>({ method: "agents.settings", ref, patch: { maxParallel: 2 } });
  expect(settled).toMatchObject({ ref, settings: { maxParallel: 2 } });
  const path = join(s.folder, ".claude", "agents", "kibo-dev.md");
  const byHand = readFileSync(path, "utf8").replace("Tu es kibo-dev.", "Écrit à la main.");
  writeFileSync(path, byHand);
  const file = agent.file;
  if (!file) throw new Error("kibo-dev unreadable");
  const conflict = await kit.rpc<SaveResult<Agent>>({
    method: "agents.save",
    ref,
    file,
    baseHash: agent.hash,
  });
  if (conflict.ok) throw new Error("expected a conflict");
  expect(readFileSync(path, "utf8")).toBe(byHand);
  const versions = await kit.rpc<FileVersion[]>({ method: "fileVersions.list", kind: "agents", ref });
  expect(versions.map((v) => v.origin)).toContain("external");
  const before = kit.events.length;
  const forced = await kit.rpc<SaveResult<Agent>>({
    method: "agents.save",
    ref,
    file,
    baseHash: conflict.conflict.hash,
  });
  expect(forced.ok).toBe(true);
  await waitFor(async () => (kit.events.slice(before).some(isTopic("agent-files")) ? true : undefined));
}, 60_000);

test("a remote reader cannot write agents or skills", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  const remote = remoteClient(kit);
  expect((await remote.raw({ method: "agents.list" })).ok).toBe(true);
  const forbidden = async (body: Record<string, unknown>) =>
    expect(await remote.raw(body)).toMatchObject({ ok: false, error: { code: "FORBIDDEN" } });
  await forbidden({
    method: "agents.create",
    scope: "global",
    name: "relecture-pr",
    description: "Relit une PR et rend un verdict",
    template: "review",
  });
  const location = { id: "brainstorming", scope: "project", projectId: s.project.id };
  await forbidden({ method: "skills.save", ...location, content: "x", baseHash: null });
  await forbidden({ method: "fileVersions.restore", id: "v1", baseHash: null });
}, 60_000);
