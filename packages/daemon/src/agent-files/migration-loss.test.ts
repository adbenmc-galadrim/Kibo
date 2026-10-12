import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { listGuidelines } from "@kibo/core/agent-config";
import { guidelinesMap, profilesMap } from "@kibo/core/config-store";
import { migrateProfiles } from "./migration";
import { files, open, tables } from "./migration.test-helper";
import { migratedName } from "./migration-names";

const QUALITY_ID = "aa11bb22-cc33-4d44-8e55-ff6677889900";

function addLegacy(m: ReturnType<typeof open>) {
  profilesMap(m.workspace).set(QUALITY_ID, {
    id: QUALITY_ID,
    name: "Revue Qualité",
    model: "sonnet",
    execution: "cli",
    permissionMode: "plan",
    workspace: "worktree",
    maxParallel: 2,
    subagents: [],
    enabled: true,
    allow: [],
    system: false,
  });
  profilesMap(m.workspace).set("broken", { id: "broken", name: "Cassé", maxParallel: "beaucoup" });
  const guidelines = guidelinesMap(m.workspace);
  const owned = (profileId: string) => ({ scope: "profile", profileId });
  guidelines.set("q1", {
    id: "q1",
    owner: owned(QUALITY_ID),
    path: "qualite/regles.md",
    content: "Vérifie les tests.",
  });
  guidelines.set("b1", {
    id: "b1",
    owner: owned("broken"),
    path: "casse/notes.md",
    content: "Garde ce texte.",
  });
  guidelines.set("o1", { id: "o1", owner: owned("orphan"), path: "orphelin.md", content: "Texte orphelin." });
  m.workspace.commit();
}

test("normalized names: suggestion first, then migrated-<slug>", () => {
  expect(migratedName("review-pr", "x")).toBe("review-pr");
  expect(migratedName("Revue Qualité", "x")).toBe("revue-qualite");
  expect(migratedName("kibo-demo", "x")).toBe("migrated-kibo-demo");
  expect(migratedName("Opus", "x")).toBe("opus");
  expect(migratedName("!!!", "x")).toMatch(/^migrated-[0-9a-f]{8}$/);
});

test("a profile with an invalid name is migrated under a normalized name with its guidelines", async () => {
  const m = open();
  addLegacy(m);
  const { notices } = await migrateProfiles(m.input);
  const text = readFileSync(join(m.agents, "revue-qualite.md"), "utf8");
  expect(text).toContain("description: Agent migré du profil Kibo Revue Qualité");
  expect(text).toContain("## qualite/regles.md\n\nVérifie les tests.");
  expect(m.settings.get("global:revue-qualite")).toMatchObject({ permissionMode: "plan", maxParallel: 2 });
  expect(m.runs.records().length).toBeGreaterThan(0);
  expect(notices.find((n) => n.profileName === "Revue Qualité")?.text).toContain(
    "migré sous le nom revue-qualite",
  );
  m.close();
});

test("guidelines of an unreadable profile or of no profile go to the history, never lost", async () => {
  const m = open();
  addLegacy(m);
  const { notices } = await migrateProfiles(m.input);
  expect(listGuidelines(m.workspace).map((g) => g.path)).toEqual(["commun.md"]);
  const broken = m.history.list("agents", "global:casse");
  expect(broken.map((v) => v.origin)).toEqual(["migration"]);
  expect(m.history.read(broken[0]?.id ?? "")?.content).toContain("Garde ce texte.");
  const orphan = m.history.list("agents", "global:orphan");
  expect(m.history.read(orphan[0]?.id ?? "")?.content).toContain("Texte orphelin.");
  expect(notices.find((n) => n.profileName === "Cassé")?.text).toContain("historique de l'agent casse");
  m.close();
});

test("a second pass changes nothing", async () => {
  const m = open();
  addLegacy(m);
  await migrateProfiles(m.input);
  const before = {
    files: files(m.agents),
    tables: tables(m.store.db),
    runs: JSON.stringify(m.runs.records()),
  };
  expect(await migrateProfiles(m.input)).toEqual({ migrated: false, notices: [] });
  expect({
    files: files(m.agents),
    tables: tables(m.store.db),
    runs: JSON.stringify(m.runs.records()),
  }).toEqual(before);
  m.close();
});
