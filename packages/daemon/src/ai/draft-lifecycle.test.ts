import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { KiboError } from "@kibo/schema";
import { draftPaths, readDraftManifest } from "./draft-files";
import {
  burndownAt,
  cleanLifecycles,
  create,
  done,
  report,
  setupLifecycle,
  writeSource,
} from "./testing/lifecycle-fixture";

cleanLifecycles();

describe("start", () => {
  test("refuses without AI, with a taken id, and with a second active draft", async () => {
    await expect(
      setupLifecycle({ status: { available: false, reason: "missing" } }).life.start(create),
    ).rejects.toThrow("AI_UNAVAILABLE");
    await expect(
      setupLifecycle({ status: { profiles: { assistant: true, generateur: false } } }).life.start(create),
    ).rejects.toThrow("AI_UNAVAILABLE");
    const { life } = setupLifecycle();
    await expect(life.start({ ...create, id: "kanban" })).rejects.toThrow("CONFLICT");
    await life.start(create);
    await expect(life.start(create)).rejects.toThrow("CONFLICT");
  });

  test("modify refuses an unknown component and an adapter", async () => {
    const adapter = burndownAt("0.1.0");
    const { srcRoot, life } = setupLifecycle({
      published: { ...adapter, manifest: { ...adapter.manifest, kind: "adapter" } },
    });
    const modify = { mode: "modify", id: "burndown", description: "Ajoute un titre" } as const;
    await expect(life.start(modify)).rejects.toThrow("NOT_FOUND");
    writeSource(srcRoot);
    await expect(life.start(modify)).rejects.toThrow("INVALID_INPUT");
  });

  test("scaffolds the draft, writes the rules and enqueues a guarded generator run", async () => {
    const { home, runs, events, life } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    expect(d).toMatchObject({ status: "generating", attempts: 1, runId: "run-1" });
    expect(readFileSync(join(paths.dir, "CLAUDE.md"), "utf8")).toContain("ui.tsx");
    const req = runs.runs[0]?.req;
    expect(req).toMatchObject({
      profileId: "generateur",
      cwd: paths.dir,
      resumeSessionId: null,
      env: { PATH: "/kibo/bin" },
    });
    expect(req?.prompt).toContain("kibo component test .");
    expect(
      req?.guard({ toolName: "Write", toolInput: { file_path: join(paths.dir, "kibo.component.json") } })
        .decision,
    ).toBe("deny");
    expect(
      req?.guard({ toolName: "Write", toolInput: { file_path: join(paths.dir, "ui.tsx") } }).decision,
    ).toBe("allow");
    expect(events.events.at(-1)).toEqual({ type: "draft.changed", draftId: d.id, status: "generating" });
  });
});

describe("after the run", () => {
  test("restores reserved files, writes inferred permissions, validates, reaches review", async () => {
    const { home, runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    writeFileSync(join(paths.dir, "kibo.component.json"), '{"id":"evil"}');
    runs.end("run-1", done());
    await life.idle();
    const after = store.get(d.id);
    expect(after).toMatchObject({
      status: "review",
      sessionId: "s1",
      incidents: [{ kind: "restored", path: "kibo.component.json" }],
    });
    expect(readDraftManifest(paths.dir)).toMatchObject({ id: "burndown", reads: ["ticket"] });
    expect(store.report(d.id)?.ok).toBe(true);
  });

  test("usages found by the conformance are declared, then validated once more", async () => {
    const { home, runs, store, life, validations } = setupLifecycle({
      reports: [report(true, ["net:https://api.github.com/graphql"]), report(true)],
    });
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    expect(store.get(d.id).status).toBe("review");
    expect(readDraftManifest(draftPaths(home, d.id).dir).net).toEqual(["api.github.com/graphql"]);
    expect(validations()).toBe(2);
  });

  test("a missing secret is never declared and fails the validation", async () => {
    const { runs, store, life, validations } = setupLifecycle({
      reports: [report(true, ["secret:github@api.github.com"])],
    });
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    expect(store.get(d.id)).toMatchObject({ status: "failed", failure: { kind: "validation" } });
    expect(validations()).toBe(1);
  });

  test("a non-literal argument skips inference and lets the validation report it", async () => {
    const { runs, store, life, setInferError } = setupLifecycle({ reports: [report(false)] });
    setInferError(new KiboError("VALIDATION_FAILED", "non-literal argument"));
    const d = await life.start(create);
    runs.end("run-1", done());
    await life.idle();
    expect(store.get(d.id)).toMatchObject({ status: "failed", failure: { kind: "validation" } });
  });

  test("a corrupted base fails the draft visibly instead of hanging in validation", async () => {
    const { home, runs, store, life, validations } = setupLifecycle();
    const d = await life.start(create);
    const paths = draftPaths(home, d.id);
    rmSync(paths.baseDir, { recursive: true, force: true });
    writeFileSync(paths.baseDir, "not a folder");
    runs.end("run-1", done());
    await life.idle();
    const after = store.get(d.id);
    expect(after).toMatchObject({ status: "failed", failure: { kind: "validation" } });
    expect(after.failure?.detail).toContain("STORE_CORRUPT");
    expect(validations()).toBe(0);
  });

  test("a failed run is recorded; retry without session starts afresh", async () => {
    const { runs, store, life } = setupLifecycle();
    const d = await life.start(create);
    runs.end("run-1", { state: "failed", sessionId: null, stdout: "", error: "exit 1" });
    await life.idle();
    expect(store.get(d.id).failure).toEqual({ kind: "run_failed", detail: "exit 1" });
    life.retry(d.id);
    expect(runs.runs[1]?.req.resumeSessionId).toBeNull();
  });

  test("retry resumes the session with the report, three attempts at most", async () => {
    const { runs, store, life } = setupLifecycle({ reports: [report(false), report(false), report(false)] });
    const d = await life.start(create);
    for (const [i, runId] of ["run-1", "run-2", "run-3"].entries()) {
      runs.end(runId, done());
      await life.idle();
      expect(store.get(d.id).status).toBe("failed");
      if (i < 2) {
        life.retry(d.id);
        expect(runs.runs[i + 1]?.req).toMatchObject({ resumeSessionId: "s1" });
        expect(runs.runs[i + 1]?.req.prompt).toContain("error TS2322");
      }
    }
    expect(store.get(d.id).attempts).toBe(3);
    expect(() => life.retry(d.id)).toThrow("INVALID_INPUT");
    expect(runs.runs).toHaveLength(3);
  });

  test("retry while generating is refused", async () => {
    const { life } = setupLifecycle();
    const d = await life.start(create);
    expect(() => life.retry(d.id)).toThrow("INVALID_INPUT");
  });
});

describe("abandon, folder, revalidate", () => {
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

  test("openFolder opens the draft folder in the editor", async () => {
    const { home, life, opened } = setupLifecycle();
    const d = await life.start(create);
    await life.openFolder(d.id);
    expect(opened).toEqual([draftPaths(home, d.id).dir]);
  });

  test("modify: copies the source; a hand-made config change fails revalidation", async () => {
    const { home, srcRoot, runs, store, life } = setupLifecycle({
      published: burndownAt("0.1.0"),
      reports: [report(false)],
    });
    writeSource(srcRoot);
    const d = await life.start({ mode: "modify", id: "burndown", description: "Ajoute un titre" });
    expect(d).toMatchObject({ mode: "modify", baseVersion: "0.1.0", title: "Burndown", withServer: false });
    runs.end("run-1", done());
    await life.idle();
    const paths = draftPaths(home, d.id);
    const m = readDraftManifest(paths.dir);
    writeFileSync(join(paths.dir, "kibo.component.json"), JSON.stringify({ ...m, configVersion: 1 }));
    await life.revalidate(d.id);
    expect(store.get(d.id).failure).toEqual({ kind: "config_changed", detail: null });
  });
});
