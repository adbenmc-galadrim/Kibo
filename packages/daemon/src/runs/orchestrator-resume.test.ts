import { expect, test } from "bun:test";
import {
  cleanHarness,
  projectAgentAgent,
  run,
  setup,
  startProject,
  waitUntil,
} from "./orchestrator.test-helper";

cleanHarness();

test("a run whose profile was deleted cannot be written to", async () => {
  const profiles = [projectAgentAgent()];
  const h = setup({ scenario: "done", profiles });
  const r = startProject(h);
  await waitUntil(() => run(h, r.id).state === "done");
  expect(h.orch.state().resumable).toEqual([r.id]);
  profiles.splice(0);
  expect(h.orch.state().resumable).toEqual([]);
  expect(() => h.orch.answer(r.id, "x")).toThrow("INVALID_TRANSITION");
}, 30_000);
