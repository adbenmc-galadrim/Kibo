import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentDraft } from "@kibo/schema";
import { draftPaths, readDraftManifest, writeDraftManifest } from "./draft-files";
import { applyDraftEvent } from "./draft-machine";
import { installDraft } from "./draft-source";
import type { DraftStore } from "./draft-store";
import {
  burndownAt,
  cleanLifecycles,
  create,
  done,
  setupLifecycle,
  writeSource,
} from "./testing/lifecycle-fixture";

cleanLifecycles();

const toPermissions = (store: DraftStore, d: ComponentDraft) =>
  store.save(applyDraftEvent(store.get(d.id), { type: "reviewed" }, 2_000));

async function installedModify(version: string) {
  const setup = setupLifecycle({ published: burndownAt("0.1.0") });
  const src = writeSource(setup.srcRoot);
  const d = await setup.life.start({ mode: "modify", id: "burndown", description: "Ajoute un titre" });
  setup.runs.end("run-1", done());
  await setup.life.idle();
  toPermissions(setup.store, d);
  const dir = draftPaths(setup.home, d.id).dir;
  writeDraftManifest(dir, { ...readDraftManifest(dir), version });
  writeFileSync(join(dir, "ui.tsx"), "new");
  installDraft(dir, src);
  return { ...setup, d, src, backup: join(setup.srcRoot, ".burndown.kibo-backup") };
}

async function createInPermissions() {
  const setup = setupLifecycle();
  const d = await setup.life.start(create);
  setup.runs.end("run-1", done());
  await setup.life.idle();
  toPermissions(setup.store, d);
  return { ...setup, d, src: join(setup.srcRoot, "burndown") };
}

const handMade = (src: string, manifest: object | null) => {
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, "ui.tsx"), "mine");
  if (manifest) writeFileSync(join(src, "kibo.component.json"), JSON.stringify(manifest));
};

describe("abandon and the published version (I44)", () => {
  test("a foreign publication is not the draft's: the backup comes back", async () => {
    const { life, d, src, backup, setPublished } = await installedModify("0.2.0");
    setPublished(burndownAt("0.1.1"));
    life.abandon(d.id);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(existsSync(backup)).toBe(false);
  });

  test("a draft that kept the base version is never taken as published", async () => {
    const { life, d, src, backup } = await installedModify("0.1.0");
    life.abandon(d.id);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(existsSync(backup)).toBe(false);
  });

  test("a restart does not complete an install that kept the base version", async () => {
    const { life, d, store, src, backup } = await installedModify("0.1.0");
    await life.recover();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(existsSync(backup)).toBe(false);
    expect(store.get(d.id).status).toBe("permissions");
  });

  test("a create whose id was published by someone else still frees its own source", async () => {
    const { home, life, d, src, setPublished } = await createInPermissions();
    installDraft(draftPaths(home, d.id).dir, src);
    setPublished(burndownAt("0.3.0"));
    life.abandon(d.id);
    expect(existsSync(src)).toBe(false);
  });
});

describe("abandon never removes a source that is not the draft's (I44)", () => {
  test("a hand-made folder with another version stays", async () => {
    const { life, d, src, store } = await createInPermissions();
    handMade(src, { ...burndownAt("0.5.0").manifest });
    life.abandon(d.id);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("mine");
    expect(store.get(d.id).status).toBe("abandoned");
  });

  test("a hand-made folder with another id or without manifest stays", async () => {
    const first = await createInPermissions();
    handMade(first.src, { ...burndownAt("0.1.0").manifest, id: "velocity" });
    first.life.abandon(first.d.id);
    expect(existsSync(first.src)).toBe(true);
    const second = await createInPermissions();
    handMade(second.src, null);
    second.life.abandon(second.d.id);
    expect(existsSync(second.src)).toBe(true);
  });

  test("a source replaced since the install keeps both the source and the backup", async () => {
    const { life, d, src, backup } = await installedModify("0.2.0");
    writeFileSync(join(src, "kibo.component.json"), JSON.stringify(burndownAt("0.9.0").manifest));
    life.abandon(d.id);
    expect(readDraftManifest(src).version).toBe("0.9.0");
    expect(existsSync(backup)).toBe(true);
  });
});

describe("abandon while an agent or a validation still writes", () => {
  test("abandon cancels the run, removes the folders, ignores the late end", async () => {
    const { home, runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    life.abandon(d.id);
    expect(runs.cancelled).toEqual(["run-1"]);
    expect(existsSync(draftPaths(home, d.id).dir)).toBe(false);
    await life.idle();
    expect(store.get(d.id).status).toBe("abandoned");
    expect(() => life.abandon(d.id)).toThrow("INVALID_INPUT");
  });

  test("abandon during inference stays abandoned without a report", async () => {
    const { runs, store, life, holdInfer, validations } = setupLifecycle();
    const release = holdInfer();
    const d = await life.start(create);
    runs.end("run-1", done());
    life.abandon(d.id);
    release();
    await life.idle();
    expect(store.get(d.id).status).toBe("abandoned");
    expect(store.report(d.id)).toBeNull();
    expect(validations()).toBe(0);
  });

  test("a late write before the cancelled run really ends leaves no folder behind", async () => {
    const { home, runs, store, life } = setupLifecycle();
    runs.deferCancel();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    life.abandon(d.id);
    expect(runs.cancelled).toEqual(["run-1"]);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(join(paths.dir, "ui.tsx"), "late");
    runs.end("run-1", { state: "cancelled", sessionId: null, stdout: "", error: null });
    await life.idle();
    expect(existsSync(paths.dir)).toBe(false);
    expect(existsSync(`${paths.dir}.unrestored`)).toBe(false);
    expect(store.get(d.id).status).toBe("abandoned");
  });

  test("a validation that writes after the abandon leaves no folder behind", async () => {
    const { home, runs, life, holdInfer } = setupLifecycle();
    const release = holdInfer();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    runs.end("run-1", done());
    life.abandon(d.id);
    mkdirSync(paths.dir, { recursive: true });
    writeFileSync(join(paths.dir, "tsconfig.tsbuildinfo"), "late");
    release();
    await life.idle();
    expect(existsSync(paths.dir)).toBe(false);
  });
});
