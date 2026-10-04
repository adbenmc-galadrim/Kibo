import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { MAX_DRAFT_REVISIONS } from "@kibo/schema";
import { draftPaths } from "./draft-files";
import { cleanLifecycles, create, done, setupLifecycle } from "./testing/lifecycle-fixture";
import { feedback, gif, PNG, png, reviewed } from "./testing/revise-fixture";

cleanLifecycles();

describe("images at start", () => {
  test("are written beside the draft, listed in the prompt and readable by the agent only", async () => {
    const { home, runs, store, life } = setupLifecycle();
    const d = await life.start({ ...create, attachments: [png("maquette.png"), png("b.png")] });
    const paths = draftPaths(home, d.id);
    expect(readdirSync(paths.attachmentsDir).sort()).toEqual(["1-maquette.png", "2-b.png"]);
    for (const dir of [paths.dir, paths.baseDir])
      expect(readdirSync(dir).some((name) => name.endsWith(".png"))).toBe(false);
    expect(store.get(d.id).attachments).toEqual([
      { name: "maquette.png", mime: "image/png", bytes: PNG.length },
      { name: "b.png", mime: "image/png", bytes: PNG.length },
    ]);
    const req = runs.runs[0]?.req;
    const image = join(paths.attachmentsDir, "1-maquette.png");
    expect(req?.prompt).toContain(image);
    expect(req?.env.KIBO_DRAFT_ATTACHMENTS).toBe(paths.attachmentsDir);
    expect(req?.guard({ toolName: "Read", toolInput: { file_path: image } }).decision).toBe("allow");
    expect(req?.guard({ toolName: "Write", toolInput: { file_path: image } }).decision).toBe("deny");
  });

  test("a forged image or a fifth one refuses the start before anything is created", async () => {
    const { home, store, life } = setupLifecycle();
    await expect(life.start({ ...create, attachments: [png("a.png"), gif("b.png")] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(life.start({ ...create, attachments: Array(5).fill(png("a.png")) })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(store.list()).toEqual([]);
    expect(existsSync(join(home, "components", "drafts"))).toBe(false);
  });

  test("without images, the agent reads no images folder", async () => {
    const { home, runs, life } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    expect(existsSync(paths.attachmentsDir)).toBe(false);
    expect(runs.runs[0]?.req.env.KIBO_DRAFT_ATTACHMENTS).toBe(paths.attachmentsDir);
  });

  test("abandoning the draft removes its images", async () => {
    const { paths, life, d } = await reviewed();
    life.abandon(d.id);
    expect(existsSync(paths.attachmentsDir)).toBe(false);
  });
});

describe("formats at start", () => {
  test("the chosen template reaches the scaffold, the draft and the prompt", async () => {
    const { runs, store, life, scaffolds } = setupLifecycle();
    const d = await life.start({ ...create, template: "3d" });
    expect(scaffolds.map((s) => s.template)).toEqual(["3d"]);
    expect(store.get(d.id).template).toBe("3d");
    expect(runs.runs[0]?.req.prompt).toContain("Le gabarit 3D est déjà en place");
  });

  test("the chosen formats, or those of the kind, reach the scaffold", async () => {
    const { runs, life, scaffolds } = setupLifecycle();
    const d = await life.start({ ...create, formats: ["small", "medium"] });
    runs.end(d.runId ?? "", { state: "cancelled", sessionId: null, stdout: "", error: null });
    await life.idle();
    life.abandon(d.id);
    await life.start({ ...create, kind: "view" });
    expect(scaffolds.map((s) => s.formats)).toEqual([["small", "medium"], ["full"]]);
  });

  test("formats that do not fit the kind refuse the start before anything is created", async () => {
    const { home, store, life } = setupLifecycle();
    const refused = life.start({ ...create, kind: "view", formats: ["medium"] });
    await expect(refused).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(refused).rejects.not.toThrow("INVALID_MANIFEST");
    await expect(life.start({ ...create, formats: ["medium", "medium"] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(store.list()).toEqual([]);
    expect(existsSync(join(home, "components", "drafts"))).toBe(false);
  });
});

describe("revise", () => {
  test("relaunches the same session with the feedback and new images, from review", async () => {
    const { runs, store, life, d, paths } = await reviewed();
    const revised = await life.revise({ draftId: d.id, feedback, attachments: [png("b.png")] });
    expect(revised).toMatchObject({ status: "generating", revisions: 1, attempts: 1, runId: "run-2" });
    expect(revised.attachments.map((a) => a.name)).toEqual(["a.png", "b.png"]);
    expect(store.get(d.id)).toEqual(revised);
    const last = runs.runs.at(-1)?.req;
    expect(last?.resumeSessionId).toBe("s1");
    expect(last?.prompt).toContain(feedback);
    expect(last?.prompt).toContain(join(paths.attachmentsDir, "2-b.png"));
    expect(last?.prompt).not.toContain("1-a.png");
    expect(last?.prompt).toContain("kibo component test .");
    expect(last?.env.KIBO_DRAFT_ATTACHMENTS).toBe(paths.attachmentsDir);
    expect(last?.profileId).toBe("generateur");
    await expect(life.revise({ draftId: d.id, feedback: "encore", attachments: [] })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    runs.end("run-2", done());
    await life.idle();
    expect(store.get(d.id)).toMatchObject({ status: "review", revisions: 1 });
  });

  test("is accepted from permissions, refused elsewhere, and a forged image writes nothing", async () => {
    const { store, life, d, paths, runs } = await reviewed();
    await expect(
      life.revise({ draftId: d.id, feedback, attachments: [png("b.png"), gif("c.png")] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(readdirSync(paths.attachmentsDir)).toEqual(["1-a.png"]);
    expect(store.get(d.id)).toMatchObject({ status: "review", revisions: 0 });
    store.save({ ...store.get(d.id), status: "permissions" });
    await expect(life.revise({ draftId: d.id, feedback, attachments: [] })).resolves.toMatchObject({
      status: "generating",
    });
    store.save({ ...store.get(d.id), status: "failed" });
    await expect(life.revise({ draftId: d.id, feedback, attachments: [png("z.png")] })).rejects.toMatchObject(
      {
        code: "INVALID_INPUT",
      },
    );
    expect(readdirSync(paths.attachmentsDir)).toEqual(["1-a.png"]);
    expect(runs.runs).toHaveLength(2);
  });

  test("ten revisions at most", async () => {
    const { store, life, d, runs } = await reviewed();
    store.save({ ...store.get(d.id), revisions: MAX_DRAFT_REVISIONS - 1 });
    await life.revise({ draftId: d.id, feedback, attachments: [] });
    runs.end("run-2", done());
    await life.idle();
    expect(store.get(d.id)).toMatchObject({ status: "review", revisions: MAX_DRAFT_REVISIONS });
    await expect(life.revise({ draftId: d.id, feedback, attachments: [] })).rejects.toThrow(
      "no revision left",
    );
    expect(runs.runs).toHaveLength(2);
  });

  test("refused without AI", async () => {
    const { life, d } = await reviewed();
    const offline = setupLifecycle({ status: { available: false, reason: "missing" } });
    offline.store.insert(d);
    await expect(offline.life.revise({ draftId: d.id, feedback, attachments: [] })).rejects.toThrow(
      "AI_UNAVAILABLE",
    );
    await expect(life.revise({ draftId: crypto.randomUUID(), feedback, attachments: [] })).rejects.toThrow(
      "NOT_FOUND",
    );
  });
});
