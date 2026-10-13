import { expect, test } from "bun:test";
import type { RunView } from "@kibo/schema";
import { cleanTraceDirs, hook, type Setup, setup } from "./trace.test-helper";

cleanTraceDirs();

const resumedOf = (s: Setup): RunView => ({
  ...s.run,
  id: "run-2",
  resumedFrom: s.run.id,
  session: { mode: "resumed", from: s.run.id },
});

const narrated = (s: Setup, runId: string) => s.store.list(runId).map((m) => m.data);

test("a resumed run reads its file from the start when the origin offset is past its end", async () => {
  const s = setup();
  s.transcript.say("Fichier réécrit.");
  s.store.saveTrace({
    runId: s.run.id,
    path: s.path,
    offset: 1_000_000,
    source: "transcript",
    partial: null,
    doingStep: null,
    baseHead: null,
    closedAt: 1,
  });
  await s.trace.onHook(resumedOf(s), hook("Stop"));
  expect(narrated(s, "run-2")).toEqual([{ kind: "message", text: "Fichier réécrit." }]);
});

test("a resumed run never reads again what an origin fallen back on the hooks had read", async () => {
  const s = setup();
  s.transcript.say("Lu par l'origine.");
  await s.trace.onHook(s.run, hook("Stop"));
  const read = s.store.trace(s.run.id);
  if (read === null) throw new Error("origin trace missing");
  s.store.saveTrace({ ...read, source: "hooks", partial: "unknown-format", closedAt: 1 });
  s.transcript.say("Run repris.");
  await s.trace.onHook(resumedOf(s), hook("Stop"));
  expect(narrated(s, "run-2")).toEqual([{ kind: "message", text: "Run repris." }]);
});

test("a run resuming another run's session reads only what follows the resumption", async () => {
  const s = setup();
  s.transcript.say("Premier run.");
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  s.transcript.user("Reprends.");
  s.transcript.say("Run repris.");
  const resumed = {
    ...s.run,
    id: "run-2",
    resumedFrom: s.run.id,
    session: { mode: "resumed" as const, from: s.run.id },
  };
  await s.trace.onHook(resumed, hook("Stop"));
  expect(s.store.list("run-2").map((m) => m.data)).toEqual([{ kind: "message", text: "Run repris." }]);
});

test("a fresh session started after another run reads its own file from the start", async () => {
  const s = setup();
  s.transcript.say("Premier run.");
  await s.trace.onTurnEnd({ ...s.run, state: "done" });
  const fresh = { ...s.run, id: "run-2", session: { mode: "fresh" as const, reason: "user_reset" as const } };
  await s.trace.onHook(fresh, hook("Stop"));
  expect(s.store.list("run-2").map((m) => m.data)).toEqual([{ kind: "message", text: "Premier run." }]);
});
