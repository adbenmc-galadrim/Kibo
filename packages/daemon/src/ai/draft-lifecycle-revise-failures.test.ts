import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type DraftAttachment, MAX_DRAFT_ATTACHMENTS_TOTAL } from "@kibo/schema";
import { isUnrestored } from "./draft-files";
import { burndownAt, cleanLifecycles, done } from "./testing/lifecycle-fixture";
import { feedback, png, reviewed } from "./testing/revise-fixture";

cleanLifecycles();

const failed = { state: "failed", sessionId: "s1", stdout: "", error: "exit 1" } as const;
const cancelled = { state: "cancelled", sessionId: null, stdout: "", error: null } as const;

describe("a revision that cannot launch", () => {
  test("leaves the draft, its images and its numbering as they were", async () => {
    const { store, life, d, paths, runs } = await reviewed();
    const before = store.get(d.id);
    runs.refuseEnqueue(new Error("queue down"));
    await expect(life.revise({ draftId: d.id, feedback, attachments: [png("b.png")] })).rejects.toThrow(
      "queue down",
    );
    expect(store.get(d.id)).toEqual(before);
    expect(store.feedback(d.id)).toBeNull();
    expect(readdirSync(paths.attachmentsDir)).toEqual(["1-a.png"]);
    expect(isUnrestored(paths)).toBe(false);
    runs.refuseEnqueue(null);
    const revised = await life.revise({ draftId: d.id, feedback, attachments: [png("c.png")] });
    expect(revised.attachments.map((a) => a.name)).toEqual(["a.png", "c.png"]);
    expect(readdirSync(paths.attachmentsDir).sort()).toEqual(["1-a.png", "2-c.png"]);
  });

  test("a missing draft folder is STORE_CORRUPT and writes nothing", async () => {
    const { store, life, d, paths } = await reviewed();
    const before = store.get(d.id);
    rmSync(paths.dir, { recursive: true });
    await expect(life.revise({ draftId: d.id, feedback, attachments: [png("b.png")] })).rejects.toMatchObject(
      { code: "STORE_CORRUPT" },
    );
    expect(store.get(d.id)).toEqual(before);
    expect(readdirSync(paths.attachmentsDir)).toEqual(["1-a.png"]);
  });

  test("the images of a draft are capped in total", async () => {
    const { store, life, d, paths } = await reviewed();
    const one: DraftAttachment = { name: "a.png", mime: "image/png", bytes: 11 };
    store.save({ ...store.get(d.id), attachments: Array(MAX_DRAFT_ATTACHMENTS_TOTAL - 1).fill(one) });
    await expect(
      life.revise({ draftId: d.id, feedback, attachments: [png("b.png"), png("c.png")] }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(readdirSync(paths.attachmentsDir)).toEqual(["1-a.png"]);
    expect(store.list()).toHaveLength(1);
  });

  test("a half-finished publication cannot be revised", async () => {
    const { store, life, d, setPublished, runs } = await reviewed();
    store.save({ ...store.get(d.id), status: "permissions" });
    setPublished(burndownAt("0.1.0"));
    await expect(life.revise({ draftId: d.id, feedback, attachments: [] })).rejects.toMatchObject({
      code: "CONFLICT",
    });
    expect(runs.runs).toHaveLength(1);
    setPublished(burndownAt("0.0.9"));
    await expect(life.revise({ draftId: d.id, feedback, attachments: [] })).resolves.toMatchObject({
      status: "generating",
    });
  });
});

describe("the feedback survives a failed revision", () => {
  test("retry after a failed then a cancelled run resends the feedback and every image", async () => {
    const { life, d, paths, runs } = await reviewed();
    await life.revise({ draftId: d.id, feedback, attachments: [png("b.png")] });
    for (const [runId, end] of [
      ["run-2", failed],
      ["run-3", cancelled],
    ] as const) {
      runs.end(runId, end);
      await life.idle();
      life.retry(d.id);
      const prompt = runs.runs.at(-1)?.req.prompt ?? "";
      expect(prompt).toContain(feedback);
      expect(prompt).toContain(join(paths.attachmentsDir, "1-a.png"));
      expect(prompt).toContain(join(paths.attachmentsDir, "2-b.png"));
      expect(prompt).not.toContain("Écris le composant");
    }
  });

  test("retry after an interrupted revision resends the feedback", async () => {
    const { life, d, runs } = await reviewed();
    await life.revise({ draftId: d.id, feedback, attachments: [] });
    await life.recover();
    life.retry(d.id);
    expect(runs.runs.at(-1)?.req.prompt).toContain(feedback);
  });

  test("without a revision, retry keeps the generation prompt", async () => {
    const { life, d, runs, store } = await reviewed();
    store.saveFeedback(d.id, "ancien retour");
    store.save({ ...store.get(d.id), status: "failed", failure: { kind: "run_failed", detail: null } });
    life.retry(d.id);
    expect(runs.runs.at(-1)?.req.prompt).toContain("Écris le composant");
    runs.end("run-2", done());
    await life.idle();
  });
});

describe("a symbolic link in place of the images folder", () => {
  test("is never written through, read through, nor followed by the removal", async () => {
    const { home, life, d, paths, runs } = await reviewed([]);
    const outside = join(home, "outside");
    mkdirSync(outside);
    writeFileSync(join(outside, "secret.png"), "secret");
    symlinkSync(outside, paths.attachmentsDir);
    await expect(life.revise({ draftId: d.id, feedback, attachments: [png("b.png")] })).rejects.toMatchObject(
      { code: "STORE_CORRUPT" },
    );
    expect(readdirSync(outside)).toEqual(["secret.png"]);
    await life.revise({ draftId: d.id, feedback, attachments: [] });
    const guard = runs.runs.at(-1)?.req.guard;
    const through = join(paths.attachmentsDir, "secret.png");
    expect(guard?.({ toolName: "Read", toolInput: { file_path: through } }).decision).toBe("deny");
    expect(
      guard?.({ toolName: "Glob", toolInput: { pattern: "*.png", path: paths.attachmentsDir } }).decision,
    ).toBe("deny");
    life.abandon(d.id);
    expect(existsSync(paths.attachmentsDir)).toBe(false);
    expect(readdirSync(outside)).toEqual(["secret.png"]);
  });
});
