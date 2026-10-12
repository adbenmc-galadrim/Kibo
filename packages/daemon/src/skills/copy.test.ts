import { expect, test } from "bun:test";
import { existsSync, readFileSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { copyFolder } from "./copy";
import {
  cleanSkillDirs,
  fakeHistory,
  memoryWriter,
  PROJECT_ID,
  put,
  skillsFixture,
  tempDir,
} from "./fakes.test-helper";
import { openSkillReviewStore } from "./reviews-store";
import { createSkillsService } from "./service";

cleanSkillDirs();

async function rig() {
  const f = skillsFixture();
  const history = fakeHistory();
  const service = createSkillsService({
    roots: f.roots,
    projects: () => f.projects,
    history,
    writer: memoryWriter(),
    uses: { usage: () => ({ last: null, runs30d: 0 }) },
    reviews: {
      store: openSkillReviewStore(tempDir()),
      markIntegrated: () => {
        throw new Error("unused");
      },
    },
    citing: (id) => (id === "superpowers:brainstorming" ? ["global:livraison", "global:review-plan"] : []),
    emit: () => {},
    watch: null,
  });
  await service.refresh();
  return { f, history, service };
}

async function refusal(promise: Promise<unknown>): Promise<KiboError> {
  const e = await promise.catch((error: unknown) => error);
  if (!(e instanceof KiboError)) throw new Error(`expected a KiboError, got ${String(e)}`);
  return e;
}

test("create writes a SKILL.md with name and description and deposits a version", async () => {
  const { service, history, f } = await rig();
  const skill = await service.create({ source: "user", name: "revue", description: "Relit un plan" }, "adam");
  expect(skill).toMatchObject({
    id: "revue",
    source: "user",
    description: "Relit un plan",
    shadowedBy: null,
  });
  const content = readFileSync(join(f.claudeHome, "skills", "revue", "SKILL.md"), "utf8");
  expect(content).toContain("name: revue");
  expect(history.deposits.at(-1)).toMatchObject({ ref: "user:revue", origin: "kibo", content });
});

test("create refuses an existing name in the same place", async () => {
  const { service } = await rig();
  const e = await refusal(service.create({ source: "user", name: "deploy", description: "Encore" }, "adam"));
  expect(e.code).toBe("CONFLICT");
});

test("a project skill named like a personal one is created and reported as shadowed", async () => {
  const { service, f } = await rig();
  const skill = await service.create(
    { source: "project", projectId: PROJECT_ID, name: "brainstorming", description: "Version du projet" },
    "adam",
  );
  expect(skill).toMatchObject({ source: "project", projectId: PROJECT_ID, shadowedBy: "brainstorming" });
  expect(existsSync(join(f.project, ".claude", "skills", "brainstorming", "SKILL.md"))).toBe(true);
});

test("a project skill needs a project with a local folder", async () => {
  const { service } = await rig();
  const input = { source: "project" as const, name: "x-skill", description: "Sans projet" };
  expect((await refusal(service.create(input, "adam"))).code).toBe("INVALID_INPUT");
  expect((await refusal(service.create({ ...input, projectId: "nope" }, "adam"))).code).toBe("INVALID_INPUT");
});

test("copy duplicates a plugin skill folder under a new id and gives the agents citing it", async () => {
  const { service, f } = await rig();
  const { skill, citedBy } = await service.copy(
    { id: "superpowers:brainstorming", scope: "plugin", plugin: "superpowers" },
    { source: "user" },
    "brainstorming-perso",
    "adam",
  );
  expect(skill).toMatchObject({
    id: "brainstorming-perso",
    source: "user",
    readOnly: false,
    name: "brainstorming-perso",
  });
  expect(skill.files.map((a) => a.path)).toEqual(["notes.txt"]);
  expect(citedBy).toEqual(["global:livraison", "global:review-plan"]);
  const copied = readFileSync(join(f.claudeHome, "skills", "brainstorming-perso", "SKILL.md"), "utf8");
  expect(copied).toContain("name: brainstorming-perso");
  expect(copied).toContain("description: Brainstorm plugin");
  const again = await refusal(
    service.copy({ id: "superpowers:brainstorming" }, { source: "user" }, "brainstorming-perso", "adam"),
  );
  expect(again.code).toBe("CONFLICT");
});

test("copying a folder skips symbolic links", async () => {
  const from = tempDir();
  put(join(from, "a.md"), "a");
  put(join(from, "sub", "b.md"), "b");
  symlinkSync("/etc/hosts", join(from, "link"));
  const to = join(tempDir(), "copy");
  await copyFolder(from, to);
  expect(readFileSync(join(to, "sub", "b.md"), "utf8")).toBe("b");
  expect(existsSync(join(to, "link"))).toBe(false);
});

test("delete deposits SKILL.md and the text assets, then removes the folder", async () => {
  const { service, history, f } = await rig();
  await service.delete({ id: "deploy", scope: "user" }, "adam");
  expect(existsSync(join(f.claudeHome, "skills", "deploy"))).toBe(false);
  expect(history.deposits.map((d) => [d.ref, d.file, d.origin])).toEqual([
    ["user:deploy", "SKILL.md", "delete"],
    ["user:deploy", "reference.md", "delete"],
    ["user:deploy", "script.sh", "delete"],
  ]);
  expect(service.byId("deploy")?.source).toBe("project");
});
