import { expect, test } from "bun:test";
import { cleanTraceDirs, hook, setup } from "./trace.test-helper";

cleanTraceDirs();

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
