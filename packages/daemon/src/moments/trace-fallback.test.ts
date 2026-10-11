import { expect, test } from "bun:test";
import { appendFileSync, chmodSync, rmSync } from "node:fs";
import { join } from "node:path";
import { cleanTraceDirs, hook, kinds, SESSION, setup, tmp } from "./trace.test-helper";

cleanTraceDirs();

test("a line longer than a pass becomes one bounded raw moment and reading goes on", async () => {
  const s = setup({ maxBytes: 1024 });
  s.transcript.raw(`ghp_abcdefghijklmnopqrstuvwxyz0123 ${"y".repeat(3_000)}`);
  s.transcript.say("Après.");
  await s.trace.onHook(s.run, hook("PostToolUse"));
  const [raw, message] = s.store.list(s.run.id).map((m) => m.data);
  expect(raw).toMatchObject({ kind: "raw", partial: null });
  expect(raw?.kind === "raw" && raw.text.length).toBeLessThanOrEqual(2_000);
  expect(JSON.stringify(raw)).not.toContain("ghp_abc");
  expect(message).toEqual({ kind: "message", text: "Après." });
});

test("a rejected path falls back on hook actions, once", async () => {
  const outside = join(tmp(), `${SESSION}.jsonl`);
  const s = setup({ transcriptPath: outside });
  await s.trace.onHook(
    s.run,
    hook("PostToolUse", { tool: "Edit", detail: "src/a.ts", transcriptPath: outside }),
  );
  await s.trace.onHook(
    s.run,
    hook("PostToolUse", { tool: "Bash", detail: "bun test", transcriptPath: outside }),
  );
  expect(s.trace.trace(s.run.id)).toMatchObject({ source: "hooks", partial: "path-rejected" });
  expect(s.store.list(s.run.id).map((m) => m.data)).toEqual([
    { kind: "raw", text: "", partial: "path-rejected" },
  ]);
  await s.trace.onHook(s.run, hook("Stop", { detail: "Fini.", transcriptPath: outside }));
  const data = s.store.list(s.run.id).map((m) => m.data);
  expect(data.slice(1)).toEqual([
    expect.objectContaining({
      kind: "actions",
      summary: "A modifié 1 fichier et lancé les tests",
      failed: false,
    }),
    { kind: "message", text: "Fini." },
  ]);
  expect(s.reads.count).toBe(0);
});

test("a null transcript path decides nothing until a path is known", async () => {
  const s = setup();
  const pathless = { ...s.run, transcriptPath: null };
  await s.trace.onHook(pathless, hook("PostToolUse", { tool: "Read" }));
  await s.trace.onHook(pathless, hook("Stop"));
  expect(s.trace.trace(s.run.id)?.source ?? "pending").toBe("pending");
  expect(kinds(s)).toEqual([]);
  s.transcript.say("Enfin.");
  await s.trace.onHook(s.run, hook("Stop", { transcriptPath: s.path }));
  expect(s.trace.trace(s.run.id)).toMatchObject({ source: "transcript", partial: null });
  expect(kinds(s)).toEqual(["message"]);
});

test("a store failure while receiving a hook rejects the promise, never throws", async () => {
  const s = setup({
    wrapStore: (store) => ({
      ...store,
      saveInternalPlan: () => {
        throw new Error("SQLITE_FULL");
      },
    }),
  });
  const todos = [{ content: "Lire", status: "pending" as const }];
  let result: Promise<void> | null = null;
  expect(() => {
    result = s.trace.onHook(s.run, hook("PostToolUse", { tool: "TodoWrite", todos }));
  }).not.toThrow();
  await expect(result ?? Promise.resolve()).rejects.toThrow("SQLITE_FULL");
});

test("an unreadable transcript switches to hooks with a partial line", async () => {
  if (process.getuid?.() === 0) return;
  const s = setup();
  s.transcript.say("Avant.");
  await s.trace.onHook(s.run, hook("PostToolUse"));
  s.transcript.say("Après.");
  chmodSync(s.path, 0o000);
  await s.trace.onHook(s.run, hook("PostToolUse", { tool: "Read", detail: "a.ts" }));
  expect(s.trace.trace(s.run.id)).toMatchObject({ source: "hooks", partial: "unreadable" });
  expect(kinds(s)).toEqual(["message", "raw"]);
  await s.trace.onHook(s.run, hook("Stop"));
  expect(kinds(s)).toEqual(["message", "raw", "actions"]);
});

test("a transcript of unknown format becomes partial, an isolated unknown line does not", async () => {
  const s = setup();
  s.transcript.raw("pas du json");
  s.transcript.raw('{"type":"mystery"}');
  await s.trace.onHook(s.run, hook("PostToolUse"));
  expect(s.trace.trace(s.run.id)?.source).toBe("transcript");

  const other = setup();
  const lines = ["pas du json", "{}", '{"type":"mystery"}', "encore"];
  rmSync(other.path);
  for (const line of lines) appendFileSync(other.path, `${line}\n`);
  await other.trace.onHook(other.run, hook("PostToolUse"));
  expect(other.trace.trace(other.run.id)).toMatchObject({ source: "hooks", partial: "unknown-format" });
  expect(other.store.list(other.run.id).at(-1)?.data).toEqual({
    kind: "raw",
    text: "",
    partial: "unknown-format",
  });
});
