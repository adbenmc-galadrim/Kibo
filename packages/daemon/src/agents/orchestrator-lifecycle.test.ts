import { expect, spyOn, test } from "bun:test";
import { cleanHarness, run, setup, waitUntil } from "./orchestrator.test-helper";

cleanHarness();

const assignT1 = (h: ReturnType<typeof setup>) =>
  h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: "opus", brief: "" });

test("each turn tells the lifecycle when the process is spawned and after its exit is recorded", async () => {
  const seen: string[] = [];
  const h = setup({
    scenario: "question",
    lifecycle: {
      onSpawned: async (r) => {
        seen.push(`spawned:${r.state}:${r.cwd !== null}`);
      },
      onTurnEnd: async (r) => {
        seen.push(`end:${r.state}:${r.turns}`);
      },
    },
  });
  const first = assignT1(h);
  await waitUntil(() => seen.length === 2);
  expect(seen).toEqual(["spawned:running:true", "end:waiting_input:1"]);
  h.orch.answer(first.id, "Port dynamique");
  await waitUntil(() => seen.length === 4);
  expect(seen.slice(2)).toEqual(["spawned:running:true", "end:done:2"]);
  expect(run(h, first.id).state).toBe("done");
});

test("a failing lifecycle is logged and never fails the run", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const boom = async () => {
      throw new Error("git missing");
    };
    const h = setup({ scenario: "done", lifecycle: { onSpawned: boom, onTurnEnd: boom } });
    const first = assignT1(h);
    await waitUntil(() => run(h, first.id).state === "done");
    await waitUntil(() => errors.mock.calls.length >= 2);
    expect(errors.mock.calls.map((c) => String(c[0]))).toEqual([
      `[kibo-daemon] spawn hook of run ${first.id} failed`,
      `[kibo-daemon] turn end hook of run ${first.id} failed`,
    ]);
  } finally {
    errors.mockRestore();
  }
});
