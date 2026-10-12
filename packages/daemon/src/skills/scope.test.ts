import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import {
  cleanSkillDirs,
  fakeHistory,
  memoryWriter,
  PROJECT_ID,
  put,
  SKILL_MD,
  skillsFixture,
  tempDir,
} from "./fakes.test-helper";
import { openSkillReviewStore } from "./reviews-store";
import { createSkillsService } from "./service";

cleanSkillDirs();

const OTHER_ID = "0b9d4c2e-1a3f-4e5d-8c7b-6a5f4e3d2c1b";

async function rig() {
  const f = skillsFixture();
  const other = join(f.base, "other");
  put(join(other, ".claude", "skills", "tests", "SKILL.md"), SKILL_MD("tests", "Tests de l'autre projet"));
  const projects = [...f.projects, { id: OTHER_ID, folder: other }];
  const history = fakeHistory();
  const store = openSkillReviewStore(tempDir());
  const service = createSkillsService({
    roots: { ...f.roots, projectFolder: (id) => projects.find((p) => p.id === id)?.folder ?? null },
    projects: () => projects,
    history,
    writer: memoryWriter(),
    uses: { usage: () => ({ last: null, runs30d: 0 }) },
    reviews: {
      store,
      markIntegrated: (id, versionId, by) =>
        store.appendEvent(id, { type: "integrated", by, at: 1, versionId }),
    },
    citing: () => [],
    emit: () => {},
    watch: null,
  });
  await service.refresh();
  return { f, other, history, service, store };
}

async function refusal(promise: Promise<unknown>): Promise<KiboError> {
  const e = await promise.catch((error: unknown) => error);
  if (!(e instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(e)}`);
  return e;
}

test("two projects with the same skill name are told apart by their project, with or without a scope", async () => {
  const { f, other, service } = await rig();
  const mine = await service.read({ id: "tests", scope: "project", projectId: PROJECT_ID });
  const theirs = await service.read({ id: "tests", scope: "project", projectId: OTHER_ID });
  expect(mine.content).toContain("Lance les tests");
  expect(theirs.content).toContain("Tests de l'autre projet");
  expect((await service.read({ id: "tests", projectId: OTHER_ID })).content).toBe(theirs.content);
  expect((await refusal(service.read({ id: "tests", scope: "project" }))).code).toBe("INVALID_INPUT");
  const location = { id: "tests", scope: "project" as const, projectId: OTHER_ID };
  const saved = await service.save({
    ...location,
    content: "# autre v2\n",
    baseHash: theirs.hash,
    by: "adam",
  });
  expect(saved.ok).toBe(true);
  expect(readFileSync(join(other, ".claude", "skills", "tests", "SKILL.md"), "utf8")).toBe("# autre v2\n");
  expect(readFileSync(join(f.project, ".claude", "skills", "tests", "SKILL.md"), "utf8")).toBe(mine.content);
  expect(service.byId("tests", OTHER_ID)?.projectId).toBe(OTHER_ID);
  expect(service.byId("tests", "elsewhere")).toBeNull();
});

test("a project skill masked by a personal one stays reachable by its scope; without one the personal skill wins", async () => {
  const { f, service } = await rig();
  const project = { id: "deploy", scope: "project" as const, projectId: PROJECT_ID };
  expect((await service.read(project)).content).toContain("Déploie le projet");
  expect((await service.read({ id: "deploy", scope: "user" })).content).toContain("Déploie l'application");
  expect(service.byId("deploy", PROJECT_ID)?.source).toBe("user");
  expect((await service.read({ id: "deploy", projectId: PROJECT_ID })).content).toContain(
    "Déploie l'application",
  );
  expect(service.locate(project).shadowedBy).toBe("deploy");
  await service.delete(project, "adam");
  expect(existsSync(join(f.project, ".claude", "skills", "deploy"))).toBe(false);
  expect(existsSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"))).toBe(true);
});

test("a plugin skill is located by its plugin, never written", async () => {
  const { service } = await rig();
  const plugin = { id: "superpowers:brainstorming", scope: "plugin" as const, plugin: "superpowers" };
  expect((await service.assets(plugin)).map((a) => a.path)).toContain("notes.txt");
  expect((await refusal(service.read({ ...plugin, plugin: "autre" }))).code).toBe("NOT_FOUND");
  const save = service.save({ ...plugin, content: "x", baseHash: null, by: "adam" });
  expect((await refusal(save)).code).toBe("READ_ONLY");
});

test("restoring a skill version writes it back with a restore version", async () => {
  const { f, history, service } = await rig();
  const user = { id: "deploy", scope: "user" as const };
  const first = await service.read(user);
  const saved = await service.save({ ...user, content: "# v2\n", baseHash: first.hash, by: "adam" });
  if (!saved.ok) throw new Error("save refused");
  const kibo = history.deposits.findIndex((d) => d.origin === "kibo");
  expect(kibo).toBeGreaterThanOrEqual(0);
  const v1 = history.deposit({
    ...user,
    kind: "skills",
    ref: "user:deploy",
    file: "SKILL.md",
    content: first.content,
    origin: "external",
    by: null,
    note: null,
  });
  const restored = await service.restore(v1.id, saved.value.hash, "adam");
  expect(restored.ok).toBe(true);
  expect(readFileSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"), "utf8")).toBe(first.content);
  expect(history.deposits.at(-1)).toMatchObject({ ref: "user:deploy", origin: "restore", by: "adam" });
  const stale = await service.restore(v1.id, saved.value.hash, "adam");
  expect(stale.ok).toBe(false);
});

test("a plugin review is integrated into its copy, a closed review is refused", async () => {
  const { f, service, store } = await rig();
  const review = store.create({
    runId: "r1",
    runLabel: "kib · livraison · KIB-14",
    agentName: "livraison",
    projectId: null,
    ticketId: null,
    ticketKey: null,
    skillId: "superpowers:brainstorming",
    skillPath: null,
    baseHash: null,
    verdict: "improve",
    note: "Ajouter un exemple.",
    suggestion: "# copie v2\n",
    createdAt: 1,
  });
  const plugin = { id: "superpowers:brainstorming", scope: "plugin" as const, plugin: "superpowers" };
  await service.copy(plugin, { source: "user" }, "brainstorming-perso", "adam");
  const copy = { id: "brainstorming-perso", scope: "user" as const };
  const { hash } = await service.read(copy);
  const integrate = { ...copy, content: "# copie v2\n", baseHash: hash, reviewId: review.id, by: "adam" };
  expect((await service.save(integrate)).ok).toBe(true);
  expect(readFileSync(join(f.claudeHome, "skills", "brainstorming-perso", "SKILL.md"), "utf8")).toBe(
    "# copie v2\n",
  );
  expect(store.get(review.id)?.status).toBe("integrated");
  const again = await service.read(copy);
  const closed = service.save({ ...integrate, baseHash: again.hash });
  expect((await refusal(closed)).code).toBe("INVALID_INPUT");
});
