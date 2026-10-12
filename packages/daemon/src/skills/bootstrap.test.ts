import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_AGENT_SETTINGS, type SkillId } from "@kibo/schema";
import { createFileHistory } from "../agent-files/file-history";
import { runView } from "../questions/questions.test-helper";
import { citingAgents, skillTargetOf, startSkills } from "./bootstrap";
import { cleanSkillDirs, PROJECT_ID, skillsFixture, tempDir } from "./fakes.test-helper";
import { createSkillReviews } from "./reviews";
import { openSkillReviewStore } from "./reviews-store";

cleanSkillDirs();

async function rig() {
  const f = skillsFixture();
  const home = tempDir();
  const history = createFileHistory({ home, db: new Database(":memory:", { strict: true }) });
  let used: SkillId[] = [];
  const store = openSkillReviewStore(tempDir());
  let skills: Awaited<ReturnType<typeof startSkills>> | null = null;
  const reviews = createSkillReviews({
    store,
    uses: { byRun: () => used.map((skillId) => ({ skillId, count: 1 })) },
    skillPath: skillTargetOf(() => skills?.service ?? null),
    emit: () => {},
  });
  skills = await startSkills({
    roots: { claudeHome: f.claudeHome, projectFolder: f.roots.projectFolder },
    env: { CLAUDE_CODE_PLUGIN_CACHE_DIR: f.pluginsRoot },
    projects: () => f.projects,
    history,
    uses: { usage: () => ({ last: null, runs30d: 0 }) },
    reviews,
    agents: () => [],
    emit: () => {},
    data: { viewer: () => "adam", assertWritable: () => {} },
    watch: null,
  });
  const use = (ids: SkillId[]) => {
    used = ids;
  };
  return { f, home, skills, reviews, use };
}

test("a review records the path and hash of the skill the run could see", async () => {
  const { f, skills, reviews, use } = await rig();
  use(["tests", "deploy"]);
  const run = runView({ id: "r1", projectId: PROJECT_ID });
  await reviews.record(run, {
    reviews: [
      { skill: "tests", verdict: "ok", note: "Bien." },
      { skill: "deploy", verdict: "ok", note: "Bien." },
    ],
  });
  const [tests] = reviews.list({ runId: "r1", skillId: "tests" });
  expect(tests).toMatchObject({
    skillPath: join(f.project, ".claude", "skills", "tests"),
    baseHash: skills.service.byId("tests", PROJECT_ID)?.hash,
  });
  const [deploy] = reviews.list({ runId: "r1", skillId: "deploy" });
  expect(deploy?.skillPath).toBe(join(f.claudeHome, "skills", "deploy"));
  skills.stop();
});

test("a review from another project never points at this project's skill", async () => {
  const { reviews, use } = await rig();
  use(["tests"]);
  await reviews.record(runView({ id: "r2", projectId: "autre" }), {
    reviews: [{ skill: "tests", verdict: "ok", note: "Bien." }],
  });
  expect(reviews.list({ runId: "r2" })[0]).toMatchObject({ skillPath: null, baseHash: null });
});

test("skill versions land under the user and project-<id> keys of the history", async () => {
  const { home, skills } = await rig();
  for (const location of [
    { id: "deploy", scope: "user" as const },
    { id: "tests", scope: "project" as const, projectId: PROJECT_ID },
  ]) {
    const { hash } = await skills.service.read(location);
    await skills.service.save({ ...location, content: "# v2\n", baseHash: hash, by: "adam" });
  }
  const root = join(home, "history", "skills");
  expect(readdirSync(root).sort()).toEqual([`project-${PROJECT_ID}`, "user"]);
  expect(existsSync(join(root, "user", "deploy", "SKILL.md"))).toBe(true);
  expect(existsSync(join(root, `project-${PROJECT_ID}`, "tests", "SKILL.md"))).toBe(true);
});

test("an agent cites a skill only when it lists it", () => {
  const listed = { ...DEFAULT_AGENT_SETTINGS, skills: { mode: "list" as const, ids: ["deploy"] } };
  const citing = citingAgents(() => [
    { ref: "global:livraison", settings: listed },
    { ref: "global:review", settings: DEFAULT_AGENT_SETTINGS },
  ]);
  expect(citing("deploy")).toEqual(["global:livraison"]);
  expect(citing("tests")).toEqual([]);
});
