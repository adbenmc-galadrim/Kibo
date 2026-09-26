import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ComponentDraft } from "@kibo/schema";
import { draftPaths, installDraft, readDraftManifest, writeDraftManifest } from "./draft-files";
import { applyDraftEvent } from "./draft-machine";
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

async function crashedFinalize(opts: { published: boolean }) {
  const setup = setupLifecycle({ published: burndownAt("0.1.0") });
  const src = writeSource(setup.srcRoot);
  const d = await setup.life.start({ mode: "modify", id: "burndown", description: "Ajoute un titre" });
  setup.runs.end("run-1", done());
  await setup.life.idle();
  toPermissions(setup.store, d);
  const dir = draftPaths(setup.home, d.id).dir;
  writeDraftManifest(dir, { ...readDraftManifest(dir), version: "0.2.0" });
  writeFileSync(join(dir, "ui.tsx"), "new");
  installDraft(dir, src);
  if (opts.published) setup.setPublished(burndownAt("0.2.0"));
  return { ...setup, d, src, backup: join(setup.srcRoot, ".burndown.kibo-backup") };
}

describe("recover a generation", () => {
  test("a run still alive is cancelled and the draft fails as interrupted", async () => {
    const { runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    await life.recover();
    expect(runs.cancelled).toEqual(["run-1"]);
    await life.idle();
    expect(store.get(d.id)).toMatchObject({ status: "failed", failure: { kind: "interrupted" } });
  });

  test("a draft without its base folder is abandoned and its folder removed", async () => {
    const { home, store, life } = setupLifecycle();
    const d = await life.start(create);
    rmSync(draftPaths(home, d.id).baseDir, { recursive: true, force: true });
    await life.recover();
    expect(store.get(d.id).status).toBe("abandoned");
    expect(existsSync(draftPaths(home, d.id).dir)).toBe(false);
  });

  test("a lost run fails as interrupted and reserved files are restored", async () => {
    const { home, runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    writeFileSync(join(paths.dir, "kibo.component.json"), "{}");
    runs.runs.splice(0);
    await life.recover();
    expect(store.get(d.id)).toMatchObject({
      status: "failed",
      failure: { kind: "interrupted", detail: null },
      incidents: [{ kind: "restored", path: "kibo.component.json" }],
    });
  });

  test("a draft left validating is validated again", async () => {
    const { store, life } = setupLifecycle();
    const d = await life.start(create);
    store.save(
      applyDraftEvent(
        store.get(d.id),
        { type: "run_ended", runId: "run-1", state: "done", sessionId: "s1", error: null },
        2_000,
      ),
    );
    await life.recover();
    expect(store.get(d.id).status).toBe("review");
  });

  test("a draft left validating before its restoration is restored, then validated", async () => {
    const { home, store, life } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    writeFileSync(join(paths.dir, "evil.ts"), "x");
    store.save(
      applyDraftEvent(
        store.get(d.id),
        { type: "run_ended", runId: "run-1", state: "done", sessionId: "s1", error: null },
        2_000,
      ),
    );
    await life.recover();
    expect(store.get(d.id)).toMatchObject({
      status: "review",
      incidents: [{ kind: "removed", path: "evil.ts" }],
    });
    expect(existsSync(join(paths.dir, "evil.ts"))).toBe(false);
  });

  test("a corrupted draft fails visibly without stopping the others", async () => {
    const { home, store, life } = setupLifecycle();
    const broken = await life.start(create);
    const other = await life.start({ ...create, id: "velocity", title: "Vélocité" });
    const base = draftPaths(home, broken.id).baseDir;
    rmSync(base, { recursive: true, force: true });
    writeFileSync(base, "not a folder");
    await life.recover();
    const failed = store.get(broken.id);
    expect(failed).toMatchObject({ status: "failed", failure: { kind: "interrupted" } });
    expect(failed.failure?.detail).toContain("STORE_CORRUPT");
    expect(store.get(other.id)).toMatchObject({
      status: "failed",
      failure: { kind: "interrupted", detail: null },
    });
  });
});

describe("recover a finalization cut short", () => {
  test("an unpublished install is rolled back to the previous source", async () => {
    const { store, life, d, src, backup } = await crashedFinalize({ published: false });
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("new");
    expect(existsSync(backup)).toBe(true);
    await life.recover();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(existsSync(backup)).toBe(false);
    expect(store.get(d.id).status).toBe("permissions");
  });

  test("a published install is completed", async () => {
    const { store, life, d, src, backup } = await crashedFinalize({ published: true });
    await life.recover();
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("new");
    expect(readDraftManifest(src).version).toBe("0.2.0");
    expect(existsSync(backup)).toBe(false);
    expect(store.get(d.id).status).toBe("permissions");
  });

  test("abandon after a failed recovery puts the backup back", async () => {
    const { home, store, life, d, src, backup } = await crashedFinalize({ published: false });
    const dir = draftPaths(home, d.id).dir;
    rmSync(dir, { recursive: true, force: true });
    writeFileSync(dir, "not a folder");
    await life.recover();
    expect(existsSync(backup)).toBe(true);
    life.abandon(d.id);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("old");
    expect(existsSync(backup)).toBe(false);
    expect(store.get(d.id).status).toBe("abandoned");
  });

  test("abandon after a published install keeps the new source", async () => {
    const { home, life, d, src, backup } = await crashedFinalize({ published: true });
    const dir = draftPaths(home, d.id).dir;
    rmSync(dir, { recursive: true, force: true });
    writeFileSync(dir, "not a folder");
    await life.recover();
    life.abandon(d.id);
    expect(readFileSync(join(src, "ui.tsx"), "utf8")).toBe("new");
    expect(existsSync(backup)).toBe(false);
  });

  test("abandon of an unpublished create frees the reserved id", async () => {
    const { home, srcRoot, runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    toPermissions(store, d);
    installDraft(draftPaths(home, d.id).dir, join(srcRoot, "burndown"));
    await life.recover();
    life.abandon(d.id);
    expect(existsSync(join(srcRoot, "burndown"))).toBe(false);
    await expect(life.start(create)).resolves.toMatchObject({ componentId: "burndown" });
  });

  test("a draft awaiting permissions without a backup leaves the sources alone", async () => {
    const { srcRoot, runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    toPermissions(store, d);
    await life.recover();
    expect(existsSync(join(srcRoot, "burndown"))).toBe(false);
    expect(store.get(d.id).status).toBe("permissions");
  });
});
