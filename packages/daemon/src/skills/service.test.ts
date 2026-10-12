import { expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError, type SkillUsage } from "@kibo/schema";
import {
  cleanSkillDirs,
  fakeHistory,
  memoryWriter,
  PROJECT_ID,
  put,
  SKILL_MD,
  sha256,
  skillsFixture,
  tempDir,
} from "./fakes.test-helper";
import type { SkillLocation } from "./ports";
import { openSkillReviewStore } from "./reviews-store";
import { createSkillsService } from "./service";

cleanSkillDirs();

const DEPLOY: SkillLocation = { id: "deploy", scope: "user" };
const PLUGIN_BRAINSTORMING: SkillLocation = {
  id: "superpowers:brainstorming",
  scope: "plugin",
  plugin: "superpowers",
};
const USED: SkillUsage = { last: { runId: "r1", ticketKey: "KIB-14", at: 5 }, runs30d: 3 };

async function rig() {
  const f = skillsFixture();
  const history = fakeHistory();
  const writer = memoryWriter();
  const store = openSkillReviewStore(tempDir());
  const emitted: string[] = [];
  const integrated: string[] = [];
  const service = createSkillsService({
    roots: f.roots,
    projects: () => f.projects,
    history,
    writer,
    uses: {
      usage: (id, since) =>
        id === "deploy" && since === 1_000 - 30 * 86_400_000 ? USED : { last: null, runs30d: 0 },
    },
    reviews: {
      store,
      markIntegrated: (id, versionId, by) => {
        integrated.push(`${id}:${versionId}:${by.ref}`);
        return store.appendEvent(id, { type: "integrated", by, at: 1, versionId });
      },
    },
    citing: (id) => (id === "superpowers:brainstorming" ? ["global:livraison"] : []),
    emit: (topic) => emitted.push(topic),
    now: () => 1_000,
    watch: null,
  });
  await service.refresh();
  return { f, history, writer, store, emitted, integrated, service };
}

async function refusal(promise: Promise<unknown>): Promise<KiboError> {
  const e = await promise.catch((error: unknown) => error);
  if (!(e instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(e)}`);
  return e;
}

const reviewRow = (skillId: string) => ({
  runId: "r1",
  runLabel: "kib · livraison · KIB-14",
  agentName: "livraison",
  projectId: null,
  ticketId: null,
  ticketKey: null,
  skillId,
  skillPath: null,
  baseHash: null,
  verdict: "improve" as const,
  note: "Ajouter un exemple.",
  suggestion: "# v2",
  createdAt: 1,
});

test("list gives every source with usage, open reviews and shadowing", async () => {
  const { service, store } = await rig();
  store.create(reviewRow("deploy"));
  const { skills, partialWatch } = service.list(PROJECT_ID);
  expect(partialWatch).toBe(false);
  expect(skills.map((s) => [s.id, s.source, s.shadowedBy])).toEqual([
    ["brainstorming", "user", null],
    ["deploy", "user", null],
    ["deploy", "project", "deploy"],
    ["tests", "project", null],
    ["superpowers:brainstorming", "plugin", null],
    ["superpowers:release", "plugin", null],
  ]);
  const deploy = skills[1];
  expect(deploy?.usage).toEqual(USED);
  expect(deploy?.reviews).toEqual({ open: 1 });
  const masked = skills[2];
  expect(masked?.reviews).toEqual({ open: 0 });
  expect(masked?.usage).toEqual({ last: null, runs30d: 0 });
  expect(service.list("other").skills.map((s) => s.source)).toEqual(["user", "user", "plugin", "plugin"]);
  expect(service.byId("tests")?.projectId).toBe(PROJECT_ID);
  expect(service.byId("deploy")?.source).toBe("user");
  expect(service.byId("nope")).toBeNull();
});

test("read gives SKILL.md or a text asset, refuses a path outside, a binary or an unknown skill", async () => {
  const { service } = await rig();
  const main = await service.read(DEPLOY);
  expect(main).toMatchObject({ file: "SKILL.md", content: SKILL_MD("deploy", "Déploie l'application") });
  expect(main.hash).toBe(sha256(main.content));
  expect((await service.read(DEPLOY, "reference.md")).content).toBe("# Référence\n");
  expect((await refusal(service.read(DEPLOY, "../x"))).code).toBe("FORBIDDEN");
  expect((await refusal(service.read(DEPLOY, "link.md"))).code).toBe("FORBIDDEN");
  const binary = await refusal(service.read(DEPLOY, "image.png"));
  expect([binary.code, binary.detail]).toEqual(["INVALID_INPUT", "fichier binaire : image.png"]);
  expect((await refusal(service.read({ id: "zzz" }))).code).toBe("NOT_FOUND");
  expect((await refusal(service.read(DEPLOY, "absent.md"))).code).toBe("NOT_FOUND");
});

test("save writes with the base hash and deposits a kibo version; a stale base gives a conflict", async () => {
  const { service, history, emitted, f } = await rig();
  const { hash } = await service.read(DEPLOY);
  const saved = await service.save({ ...DEPLOY, content: "# v2\n", baseHash: hash, by: "adam" });
  expect(saved).toEqual({ ok: true, value: { hash: sha256("# v2\n"), modifiedAt: expect.any(Number) } });
  expect(readFileSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"), "utf8")).toBe("# v2\n");
  expect(history.deposits.at(-1)).toMatchObject({
    kind: "skills",
    ref: "user:deploy",
    file: "SKILL.md",
    content: "# v2\n",
    origin: "kibo",
    by: "adam",
  });
  expect(emitted).toContain("skills");
  const stale = await service.save({ ...DEPLOY, content: "# v3\n", baseHash: hash, by: "adam" });
  expect(stale).toEqual({
    ok: false,
    conflict: { content: "# v2\n", hash: sha256("# v2\n"), modifiedAt: expect.any(Number) },
  });
  expect(readFileSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"), "utf8")).toBe("# v2\n");
});

test("overwriting an external change deposits the disk version first", async () => {
  const { service, history, f } = await rig();
  writeFileSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"), "# à la main\n");
  const saved = await service.save({
    ...DEPLOY,
    content: "# mien\n",
    baseHash: sha256("# à la main\n"),
    by: "adam",
  });
  expect(saved.ok).toBe(true);
  expect(history.deposits.map((d) => [d.origin, d.content])).toEqual([
    ["external", "# à la main\n"],
    ["kibo", "# mien\n"],
  ]);
});

test("a plugin skill is read only, a binary file cannot be saved", async () => {
  const { service } = await rig();
  const save = (location: SkillLocation, file?: string) =>
    service.save({ ...location, content: "x", baseHash: null, by: "adam", ...(file ? { file } : {}) });
  expect((await refusal(save(PLUGIN_BRAINSTORMING))).code).toBe("READ_ONLY");
  expect((await refusal(service.delete(PLUGIN_BRAINSTORMING, "adam"))).code).toBe("READ_ONLY");
  expect((await refusal(service.removeAsset(PLUGIN_BRAINSTORMING, "notes.txt", "adam"))).code).toBe(
    "READ_ONLY",
  );
  expect((await refusal(save(DEPLOY, "logo.png"))).code).toBe("INVALID_INPUT");
});

test("an absent asset is created with a null base hash, a vanished file is not found", async () => {
  const { service, f } = await rig();
  const created = await service.save({
    ...DEPLOY,
    file: "docs/new.md",
    content: "# Nouveau\n",
    baseHash: null,
    by: "adam",
  });
  expect(created.ok).toBe(true);
  expect(readFileSync(join(f.claudeHome, "skills", "deploy", "docs", "new.md"), "utf8")).toBe("# Nouveau\n");
  expect((await service.assets(DEPLOY)).map((a) => a.path)).toContain("docs/new.md");
  const gone = await refusal(
    service.save({ ...DEPLOY, file: "absent.md", content: "x", baseHash: sha256("y"), by: "adam" }),
  );
  expect(gone.code).toBe("NOT_FOUND");
});

test("saving with a review id integrates the review with the version", async () => {
  const { service, store, history, integrated, f } = await rig();
  const review = store.create(reviewRow("deploy"));
  const { hash } = await service.read(DEPLOY);
  const saved = await service.save({
    ...DEPLOY,
    content: "# v2\n",
    baseHash: hash,
    reviewId: review.id,
    by: "adam",
  });
  expect(saved.ok).toBe(true);
  const version = history.deposits.at(-1);
  expect(version?.origin).toBe("integrate");
  expect(integrated).toEqual([expect.stringMatching(new RegExp(`^${review.id}:.+:adam$`))]);
  expect(store.get(review.id)?.status).toBe("integrated");
  const unknown = await refusal(
    service.save({
      ...DEPLOY,
      content: "# v3\n",
      baseHash: sha256("# v2\n"),
      reviewId: "nope",
      by: "adam",
    }),
  );
  expect(unknown.code).toBe("NOT_FOUND");
  expect(readFileSync(join(f.claudeHome, "skills", "deploy", "SKILL.md"), "utf8")).toBe("# v2\n");
});

test("remove an asset deposits it and deletes it; SKILL.md cannot be removed", async () => {
  const { service, history, f } = await rig();
  await service.removeAsset(DEPLOY, "reference.md", "adam");
  expect(existsSync(join(f.claudeHome, "skills", "deploy", "reference.md"))).toBe(false);
  expect(history.deposits.at(-1)).toMatchObject({
    origin: "delete",
    file: "reference.md",
    content: "# Référence\n",
  });
  expect((await refusal(service.removeAsset(DEPLOY, "SKILL.md", "adam"))).code).toBe("INVALID_INPUT");
  expect((await refusal(service.removeAsset(DEPLOY, "absent.md", "adam"))).code).toBe("NOT_FOUND");
});

test("the watcher is armed on the existing skill folders and refreshes on change", async () => {
  const f = skillsFixture();
  const targets: string[][] = [];
  let fire: (paths: string[] | null) => void = () => {};
  const emitted: string[] = [];
  const service = createSkillsService({
    roots: f.roots,
    projects: () => f.projects,
    history: fakeHistory(),
    writer: memoryWriter(),
    uses: { usage: () => ({ last: null, runs30d: 0 }) },
    reviews: {
      store: openSkillReviewStore(tempDir()),
      markIntegrated: () => {
        throw new Error("unused");
      },
    },
    citing: () => [],
    emit: (topic) => emitted.push(topic),
    watch: (list, onChange) => {
      targets.push(list.map((t) => t.path));
      fire = onChange;
      return { mode: () => "watch", close: () => {} };
    },
  });
  await service.refresh();
  expect(targets).toEqual([[join(f.claudeHome, "skills"), join(f.project, ".claude", "skills")]]);
  put(join(f.claudeHome, "skills", "fresh", "SKILL.md"), SKILL_MD("fresh", "Tout neuf"));
  fire(null);
  for (let i = 0; i < 50 && service.byId("fresh") === null; i++) await Bun.sleep(10);
  expect(service.byId("fresh")?.description).toBe("Tout neuf");
  expect(emitted).toContain("skills");
  service.close();
});

test("a refresh without change emits nothing", async () => {
  const { service, emitted } = await rig();
  emitted.length = 0;
  await service.refresh();
  expect(emitted).toEqual([]);
});
