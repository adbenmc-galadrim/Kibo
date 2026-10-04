import { Database } from "bun:sqlite";
import { afterEach, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ComponentDraft } from "@kibo/schema";
import { SANDBOX_INDEX } from "../components/sandbox-server";
import { draftPaths, verifyAndRestore } from "./draft-files";
import { createDraftPreview } from "./draft-preview";
import { openDraftStore } from "./draft-store";

const HASH = "a".repeat(64);
const NEXT = "b".repeat(64);
const BUNDLE = new TextEncoder().encode("mountSandboxed()");
const CSS = new TextEncoder().encode(".p{}");

const homes: string[] = [];
afterEach(() => {
  for (const h of homes.splice(0)) rmSync(h, { recursive: true, force: true });
});

const draft = (id: string, status: ComponentDraft["status"], componentId: string): ComponentDraft => ({
  id,
  componentId,
  mode: "create",
  title: "Burndown",
  kind: "widget",
  withServer: false,
  baseVersion: null,
  description: "Burndown du sprint : tickets restants par jour.",
  runId: "r1",
  sessionId: "s1",
  status,
  attempts: 1,
  failure: null,
  incidents: [],
  attachments: [],
  revisions: 0,
  template: "blank",
  createdAt: 1,
  updatedAt: 2,
});

function setup() {
  const home = mkdtempSync(join(tmpdir(), "kibo-preview-"));
  homes.push(home);
  const store = openDraftStore(new Database(":memory:", { strict: true }));
  const review = draft("0b5c1f3e-7a51-4d2a-9c1e-2f0d6f1b8a11", "review", "burndown");
  const generating = draft("1c6d2f4e-8b62-4e3b-8d2f-3a1e7a2c9b22", "generating", "velocity");
  for (const d of [review, generating]) {
    store.insert(d);
    const { dir, attachmentsDir } = draftPaths(home, d.id);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "ui.tsx"), "export const Component = () => null;\n");
    mkdirSync(attachmentsDir);
    writeFileSync(join(attachmentsDir, "1-maquette.png"), "png");
  }
  const devkit = {
    builds: 0,
    current: HASH,
    hashed: [] as string[],
    during: () => {},
    async hash(dir: string) {
      devkit.hashed.push(dir);
      if (!existsSync(dir)) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: "ENOENT" });
      return devkit.current;
    },
    async buildPreview(dir: string) {
      devkit.builds++;
      devkit.during();
      if (!existsSync(dir)) throw Object.assign(new Error(`ENOENT: ${dir}`), { code: "ENOENT" });
      return { "ui.sandbox.js": BUNDLE, "ui.css": CSS };
    },
  };
  return { home, store, review, generating, devkit };
}

test("preview builds once per hash, only for a visible draft, and the assets follow the draft's state", async () => {
  const { home, store, review, generating, devkit } = setup();
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await expect(preview(generating.id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
  const p = await preview(review.id);
  expect(p).toEqual({ hash: HASH, path: `/c/drafts/${review.id}/${HASH}/index.html` });
  expect(devkit.builds).toBe(1);
  await preview(review.id);
  expect(devkit.builds).toBe(1);
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toEqual(BUNDLE);
  expect(await assets.lookup(review.id, HASH, "ui.css")).toEqual(CSS);
  expect(await assets.lookup(review.id, HASH, "index.html")).toBe(SANDBOX_INDEX);
  expect(await assets.lookup(review.id, "0".repeat(64), "ui.css")).toBeNull();
  const built = join(home, "components", "drafts", review.id, ".kibo", "preview", HASH);
  expect(statSync(built).mode & 0o777).toBe(0o700);
  expect(readdirSync(built).sort()).toEqual(["ui.css", "ui.sandbox.js"]);
  expect(statSync(join(built, "ui.sandbox.js")).mode & 0o777).toBe(0o600);
  store.save({ ...review, status: "done" });
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toBeNull();
  expect(await assets.lookup(review.id, HASH, "index.html")).toBeNull();
});

test("a permissions draft is previewed; failed, done, abandoned or unknown drafts are not", async () => {
  const { home, store, review, devkit } = setup();
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  store.save({ ...review, status: "permissions" });
  expect((await preview(review.id)).hash).toBe(HASH);
  expect(await assets.lookup(review.id, HASH, "ui.css")).toEqual(CSS);
  for (const status of ["failed", "done", "abandoned", "validating", "describing"] as const) {
    store.save({ ...review, status });
    await expect(preview(review.id)).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(await assets.lookup(review.id, HASH, "ui.css")).toBeNull();
  }
  const unknown = "2d7e3a5f-9c73-4f4c-9e3a-4b2f8b3d0c33";
  await expect(preview(unknown)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(await assets.lookup(unknown, HASH, "ui.css")).toBeNull();
});

test("sources that change after the preview stop the old hash from being served", async () => {
  const { home, store, review, devkit } = setup();
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await preview(review.id);
  devkit.current = NEXT;
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toBeNull();
  expect(await assets.lookup(review.id, NEXT, "ui.sandbox.js")).toBeNull();
  expect((await preview(review.id)).hash).toBe(NEXT);
  expect(devkit.builds).toBe(2);
  expect(await assets.lookup(review.id, NEXT, "ui.sandbox.js")).toEqual(BUNDLE);
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toBeNull();
  const previews = join(draftPaths(home, review.id).dir, ".kibo", "preview");
  expect(readdirSync(previews)).toEqual([NEXT]);
});

test("a draft is only served its own build, never another draft's", async () => {
  const { home, store, review, generating, devkit } = setup();
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await preview(review.id);
  store.save({ ...generating, status: "review" });
  expect(await assets.lookup(generating.id, HASH, "ui.sandbox.js")).toBeNull();
  expect(devkit.hashed.every((d) => d === draftPaths(home, review.id).dir)).toBe(true);
});

test("a build left on disk is reused after a restart; a tampered one is rebuilt", async () => {
  const { home, store, review, devkit } = setup();
  await createDraftPreview({ store, home, devkit }).preview(review.id);
  const second = createDraftPreview({ store, home, devkit });
  await second.preview(review.id);
  expect(devkit.builds).toBe(1);
  expect(await second.assets.lookup(review.id, HASH, "ui.sandbox.js")).toEqual(BUNDLE);
  const built = join(draftPaths(home, review.id).dir, ".kibo", "preview", HASH);
  rmSync(join(built, "ui.sandbox.js"));
  symlinkSync(
    join(draftPaths(home, review.id).attachmentsDir, "1-maquette.png"),
    join(built, "ui.sandbox.js"),
  );
  const third = createDraftPreview({ store, home, devkit });
  await third.preview(review.id);
  expect(devkit.builds).toBe(2);
  expect(await third.assets.lookup(review.id, HASH, "ui.sandbox.js")).toEqual(BUNDLE);
});

test("a .kibo folder that is a symbolic link is refused without writing through it", async () => {
  const { home, store, review, devkit } = setup();
  const outside = mkdtempSync(join(tmpdir(), "kibo-outside-"));
  homes.push(outside);
  symlinkSync(outside, join(draftPaths(home, review.id).dir, ".kibo"));
  const { preview } = createDraftPreview({ store, home, devkit });
  await expect(preview(review.id)).rejects.toMatchObject({ code: "STORE_CORRUPT" });
  expect(existsSync(join(outside, "preview"))).toBe(false);
});

async function refusedWhile(change: (ctx: ReturnType<typeof setup>) => void) {
  const ctx = setup();
  const { home, store, review, devkit } = ctx;
  devkit.during = () => change(ctx);
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await expect(preview(review.id)).rejects.toMatchObject({ code: "CONFLICT" });
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toBeNull();
  expect(await assets.lookup(review.id, NEXT, "ui.sandbox.js")).toBeNull();
  const previews = join(draftPaths(home, review.id).dir, ".kibo", "preview");
  expect(existsSync(previews) ? readdirSync(previews) : []).toEqual([]);
}

test("sources changed while the preview is built ⇒ CONFLICT, nothing cached", async () => {
  await refusedWhile(({ devkit }) => {
    devkit.current = NEXT;
  });
});

test("a revision run during the build ⇒ CONFLICT even when the sources come back to the same hash", async () => {
  await refusedWhile(({ store, review }) => {
    store.save({ ...review, status: "generating", runId: "r2", revisions: 1 });
    store.save({ ...review, status: "review", runId: "r2", revisions: 1 });
  });
});

test("a draft that turns generating during the build ⇒ CONFLICT", async () => {
  await refusedWhile(({ store, review }) => {
    store.save({ ...review, status: "generating", runId: "r2" });
  });
});

test("a draft abandoned and removed during the build ⇒ CONFLICT, not a raw error", async () => {
  await refusedWhile(({ store, review, home }) => {
    store.save({ ...review, status: "abandoned" });
    rmSync(draftPaths(home, review.id).dir, { recursive: true, force: true });
  });
});

test("a draft folder removed during the build while still in review ⇒ CONFLICT", async () => {
  await refusedWhile(({ review, home }) => {
    rmSync(draftPaths(home, review.id).dir, { recursive: true, force: true });
  });
});

test("after a run, a preview planted by the agent is gone and the next preview rebuilds", async () => {
  const { home, store, review, devkit } = setup();
  const paths = draftPaths(home, review.id);
  mkdirSync(paths.baseDir);
  writeFileSync(join(paths.baseDir, "ui.tsx"), "export const Component = () => null;\n");
  const planted = join(paths.dir, ".kibo", "preview", HASH);
  mkdirSync(planted, { recursive: true });
  writeFileSync(join(planted, "ui.sandbox.js"), "planted");
  writeFileSync(join(planted, "ui.css"), "planted");
  verifyAndRestore(paths, false);
  const { preview, assets } = createDraftPreview({ store, home, devkit });
  await preview(review.id);
  expect(devkit.builds).toBe(1);
  expect(await assets.lookup(review.id, HASH, "ui.sandbox.js")).toEqual(BUNDLE);
});

test("the manifest of a previewable draft is read for its capabilities, never followed through a link", async () => {
  const { home, store, review, generating, devkit } = setup();
  const { assets } = createDraftPreview({ store, home, devkit });
  const manifestOf = (id: string) => join(draftPaths(home, id).dir, "kibo.component.json");
  const manifest = {
    id: "burndown",
    version: "0.1.0",
    kind: "widget",
    title: "Burndown",
    reads: [],
    writes: [],
    capabilities: ["audio"],
  };
  expect(await assets.manifest(review.id)).toBeNull();
  writeFileSync(manifestOf(review.id), JSON.stringify(manifest));
  writeFileSync(manifestOf(generating.id), JSON.stringify(manifest));
  expect((await assets.manifest(review.id))?.capabilities).toEqual(["audio"]);
  expect(await assets.manifest(generating.id)).toBeNull();
  expect(await assets.manifest("2d7e3a5f-9c73-4f4c-9e3a-4b2f8b3d0c33")).toBeNull();
  writeFileSync(manifestOf(review.id), "{ not json");
  expect(await assets.manifest(review.id)).toBeNull();
  writeFileSync(manifestOf(review.id), JSON.stringify({ ...manifest, kind: "nope" }));
  expect(await assets.manifest(review.id)).toBeNull();
  rmSync(manifestOf(review.id));
  const outside = mkdtempSync(join(tmpdir(), "kibo-outside-"));
  homes.push(outside);
  writeFileSync(join(outside, "m.json"), JSON.stringify(manifest));
  symlinkSync(join(outside, "m.json"), manifestOf(review.id));
  expect(await assets.manifest(review.id)).toBeNull();
});
