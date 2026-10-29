import { afterEach, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Agent,
  AgentPreview,
  AgentsState,
  FileVersion,
  RunView,
  SaveResult,
  Skill,
  SkillReview,
} from "@kibo/schema";
import {
  type AgentList,
  actions,
  assignAndFinish,
  type Kit,
  labels,
  momentsOf,
  readyKiboDev,
  reminders,
  remoteClient,
  type Seeded,
  seedProject,
  startKit,
  stopKits,
  waitFor,
} from "./agents-skills.test-helper";
import { fakeLaunch } from "./runs/fake-claude-launch";
import { releaseFakeRun, scenarioPath } from "./runs/fake-claude-scenario";

afterEach(stopKits);

import { FIXTURE_HOME_021 } from "./testing/make-home-0.21";

async function reviewedRun(kit: Kit, s: Seeded): Promise<RunView> {
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

test("discovered project agent kibo-dev launches with agents.json, --tools and Skill rules", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  await readyKiboDev(kit, s);
  const preview = await kit.rpc<AgentPreview>({
    method: "agents.preview",
    ref: s.ref("kibo-dev"),
    projectId: s.project.id,
  });
  expect(preview.command.allow).toEqual(
    expect.arrayContaining(["Skill(brainstorming)", "Skill(superpowers:brainstorming)"]),
  );
  expect(preview.command.subagents).toEqual(["review"]);
  const run = await assignAndFinish(kit, s, "KIB-14", s.ref("kibo-dev"));
  expect(run.state).toBe("done");
  const launch = fakeLaunch(join(kit.home, "fake", "projects"), run.sessionId);
  expect(Object.keys(launch?.agents ?? {})).toEqual(["review"]);
  expect(launch).toMatchObject({ tools: null, name: "kib · kibo-dev · KIB-14", systemPromptSnapshot: "off" });
  const page = await momentsOf(kit, run.id, (p) => labels(p).some((l) => l.includes("review de 2 skills")));
  expect(labels(page)).toEqual(
    expect.arrayContaining([
      "A utilisé le skill `brainstorming`",
      "A utilisé le skill `superpowers:brainstorming`",
      "A laissé une review de 2 skills",
    ]),
  );
  expect(reminders(page).filter((r) => r === "skills" || r === "report_skills")).toHaveLength(1);
  const reviews = await kit.rpc<SkillReview[]>({ method: "skillReviews.list", runId: run.id });
  expect(reviews.map((r) => [r.skillId, r.status])).toEqual(
    expect.arrayContaining([
      ["brainstorming", "new"],
      ["superpowers:brainstorming", "new"],
    ]),
  );
  const project = reviews.find((r) => r.skillId === "brainstorming");
  expect(project?.skillPath).toBe(join(s.folder, ".claude", "skills", "brainstorming"));
  const listed = await kit.rpc<{ skills: Skill[] }>({ method: "skills.list", projectId: s.project.id });
  const brainstorming = listed.skills.find((k) => k.id === "brainstorming");
  expect(project?.baseHash).toBe(brainstorming?.hash ?? "");
  expect(brainstorming).toMatchObject({ source: "project", reviews: { open: 1 }, usage: { runs30d: 1 } });
}, 90_000);

test("integrating a review writes the file, a version and marks the review", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  const run = await reviewedRun(kit, s);
  const reviews = await kit.rpc<SkillReview[]>({ method: "skillReviews.list", runId: run.id });
  const improve = reviews.find((r) => r.skillId === "brainstorming");
  const ok = reviews.find((r) => r.skillId === "superpowers:brainstorming");
  if (!improve?.suggestion || !ok) throw new Error("reviews missing");
  const location = { id: "brainstorming", scope: "project", projectId: s.project.id };
  const { hash } = await kit.rpc<{ hash: string }>({ method: "skills.read", ...location });
  const beforeSave = kit.events.length;
  const saved = await kit.rpc<SaveResult<{ hash: string }>>({
    method: "skills.save",
    ...location,
    content: improve.suggestion,
    baseHash: hash,
    reviewId: improve.id,
  });
  expect(saved.ok).toBe(true);
  const file = join(s.folder, ".claude", "skills", "brainstorming", "SKILL.md");
  expect(readFileSync(file, "utf8")).toBe(improve.suggestion);
  const versions = await kit.rpc<FileVersion[]>({
    method: "fileVersions.list",
    kind: "skills",
    ref: `project:${s.project.id}:brainstorming`,
    file: "SKILL.md",
  });
  expect(versions.map((v) => v.origin)).toEqual(["integrate", "external"]);
  const [integrated] = await kit.rpc<SkillReview[]>({
    method: "skillReviews.list",
    skillId: "brainstorming",
  });
  expect(integrated).toMatchObject({ id: improve.id, status: "integrated", versionId: versions[0]?.id });
  await waitFor(async () => (kit.events.slice(beforeSave).some(isTopic("skills")) ? true : undefined));
  const beforeDecide = kit.events.length;
  const ignored = await kit.rpc<SkillReview>({
    method: "skillReviews.decide",
    id: ok.id,
    decision: "ignore",
  });
  expect(ignored.status).toBe("ignored");
  await waitFor(async () => (kit.events.slice(beforeDecide).some(isTopic("skills")) ? true : undefined));
}, 90_000);

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

test("the guard denies unlisted subagents and skills and the feed shows it", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  await readyKiboDev(kit, s);
  const run = await assignAndFinish(kit, s, "KIB-15", s.ref("kibo-dev"));
  expect(run.state).toBe("done");
  expect(run.denied).toEqual(expect.arrayContaining(["Skill", "Agent"]));
  const page = await momentsOf(
    kit,
    run.id,
    (p) => actions(p).filter((a) => a.outcome === "denied").length >= 2,
  );
  const denied = actions(page).filter((a) => a.outcome === "denied");
  expect(denied.map((a) => [a.kind, a.target])).toEqual(
    expect.arrayContaining([
      ["skill", "deploy"],
      ["subagent", "seo"],
    ]),
  );
  expect(
    actions(page).some((a) => a.kind === "subagent" && a.target === "review" && a.outcome === "ok"),
  ).toBe(true);
}, 90_000);

test("a run that used a skill and never reviewed shows no review", async () => {
  const kit = await startKit();
  const s = await seedProject(kit);
  await readyKiboDev(kit, s);
  const run = await assignAndFinish(kit, s, "KIB-16", s.ref("kibo-dev"));
  expect(run.state).toBe("done");
  const page = await momentsOf(kit, run.id, (p) => reminders(p).length > 0);
  expect(reminders(page).filter((r) => r === "skills" || r === "report_skills")).toHaveLength(1);
  expect(await kit.rpc<SkillReview[]>({ method: "skillReviews.list", runId: run.id })).toEqual([]);
}, 90_000);

test("skill_review from a project run on an unused skill is refused", async () => {
  const kit = await startKit({ scenario: scenarioPath("hold") });
  const s = await seedProject(kit);
  const project = await kit.rpc<RunView>({
    method: "sendProjectAgentMessage",
    projectId: s.project.id,
    text: "Où en est-on ?",
  });
  const ticket = s.tickets.get("KIB-1");
  if (!ticket) throw new Error("no KIB-1");
  await kit.rpc<AgentList>({ method: "agents.list", projectId: s.project.id });
  const other = await kit.rpc<RunView>({
    method: "assignAgent",
    projectId: s.project.id,
    ticketId: ticket.id,
    profileId: s.ref("livraison"),
    brief: "",
  });
  const tokenOf = (runId: string) =>
    waitFor(async () => {
      try {
        const config = readFileSync(join(kit.home, "runs", runId, "mcp.json"), "utf8");
        return /"KIBO_RUN_TOKEN":\s*"([0-9a-f]{64})"/.exec(config)?.[1];
      } catch {
        return undefined;
      }
    });
  const post = (runId: string, bearer: string) =>
    fetch(`${kit.daemon.url}/agent-mcp/${runId}`, {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}`, "content-type": "application/json" },
      body: JSON.stringify({
        tool: "skill_review",
        input: { reviews: [{ skill: "zzz", verdict: "ok", note: "Rien à dire." }] },
      }),
    });
  const token = await tokenOf(project.id);
  const refused = await post(project.id, token);
  expect(await refused.json()).toEqual({
    ok: false,
    error: { code: "INVALID_INPUT", message: "skill non utilisé par ce run : zzz" },
  });
  expect((await post(project.id, await tokenOf(other.id))).status).toBe(401);
  for (const run of [project, other]) releaseFakeRun(join(kit.home, "fake", "projects"), run.sessionId);
}, 90_000);

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
