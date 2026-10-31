import { expect, spyOn, test } from "bun:test";
import {
  cleanHarness,
  projectAgentAgent,
  run,
  setup,
  startProject,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

test("each turn tells the lifecycle when the process is spawned and after its exit is recorded", async () => {
  const seen: string[] = [];
  const h = setup({
    profiles: [projectAgentAgent()],
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
  const first = startProject(h);
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
    const h = setup({
      profiles: [projectAgentAgent()],
      scenario: "done",
      lifecycle: { onSpawned: boom, onTurnEnd: boom },
    });
    const first = startProject(h);
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

function recording() {
  const seen: string[] = [];
  const record = (what: string) => async (r: { state: string }) => {
    seen.push(`${what}:${r.state}`);
  };
  const lifecycle = {
    onSpawned: record("spawned"),
    onTurnEnd: record("end"),
    onEndedWithoutTurn: record("ended"),
  };
  return { seen, lifecycle };
}

test("a run that fails before its process starts only tells the lifecycle it ended without a turn", async () => {
  const errors = spyOn(console, "error").mockImplementation(() => {});
  try {
    const { seen, lifecycle } = recording();
    const h = setup({
      profiles: [projectAgentAgent()],
      scenario: "done",
      claudeBin: "/nonexistent/claude",
      lifecycle,
    });
    const first = startProject(h);
    await waitUntil(() => seen.length === 1);
    expect(run(h, first.id).state).toBe("failed");
    expect(seen).toEqual(["ended:failed"]);
  } finally {
    errors.mockRestore();
  }
});

test("a run cancelled while it prepares only tells the lifecycle it ended without a turn", async () => {
  const { seen, lifecycle } = recording();
  const h = setup({ profiles: [projectAgentAgent()], scenario: "done", lifecycle });
  const first = startProject(h);
  expect(run(h, first.id).state).toBe("starting");
  h.orch.cancel(first.id);
  await waitUntil(() => seen.length === 1);
  await Bun.sleep(300);
  expect(seen).toEqual(["ended:cancelled"]);
  expect(h.orch.log(first.id).some((e) => e.event.type === "spawned")).toBe(false);
});

test("a run cancelled between two turns tells the lifecycle it ended without a turn", async () => {
  const { seen, lifecycle } = recording();
  const h = setup({ profiles: [projectAgentAgent()], scenario: "question", lifecycle });
  const first = startProject(h);
  await waitUntil(() => seen.length === 2);
  expect(run(h, first.id).state).toBe("waiting_input");
  h.orch.cancel(first.id);
  await waitUntil(() => seen.length === 3);
  expect(seen).toEqual(["spawned:running", "end:waiting_input", "ended:cancelled"]);
});
