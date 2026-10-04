import { expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAKE_CLAUDE, fakeCalls, scenarioPath } from "./fake-claude-scenario";
import { cleanHarness, profile, run, setup, waitUntil } from "./orchestrator.test-helper";

cleanHarness();

const demo = profile({ id: "demo", name: "demo", system: true, maxParallel: 1 });
const assistant = profile({ id: "assistant", name: "assistant", system: true, maxParallel: 1 });

test("the demo profile cannot be assigned outside the demo project", () => {
  const h = setup({ scenario: "done", profiles: [profile(), demo] });
  const input = { projectId: "p1", ticketId: "t1", profileId: "demo", brief: "" };
  expect(() => h.orch.assign(input)).toThrow(/the demo agent only works in the demo project/);
  expect(() => h.orch.preview(input)).toThrow(/the demo agent only works in the demo project/);
  expect(h.orch.state().runs).toEqual([]);
  expect(h.assigned).toEqual([]);
});

test("in the demo project the demo agent runs with its own binary and env, other system profiles stay reserved", async () => {
  const h = setup({
    scenario: "hold",
    profiles: [profile(), demo, assistant],
    demoProject: true,
    claudeBin: "/nonexistent/claude",
    demoAgent: { bin: FAKE_CLAUDE, env: () => ({ KIBO_FAKE_CLAUDE_SCENARIO: scenarioPath("done") }) },
  });
  const first = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: "demo", brief: "" });
  expect(first.profileId).toBe("demo");
  expect(() => h.orch.assign({ projectId: "p1", ticketId: "t2", profileId: "assistant", brief: "" })).toThrow(
    /reserved to Kibo/,
  );
  await waitUntil(() => run(h, first.id).state === "done");
  expect(fakeCalls(h.state, first.sessionId)).toHaveLength(1);
}, 30_000);

test("a user profile can still work on a demo ticket", async () => {
  const h = setup({ scenario: "done", demoProject: true });
  const r = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: "opus", brief: "" });
  await waitUntil(() => run(h, r.id).state === "done");
}, 30_000);

test("a demo run cannot write outside its isolated workspace, and the refusal is in the run log", async () => {
  const files = mkdtempSync(join(tmpdir(), "kibo-demo-escape-"));
  try {
    writeFileSync(join(files, "escape.md.fixture"), "dehors");
    const scenario = join(files, "escape.json");
    const step = { write: "../../escape.md", fixture: "escape.md.fixture" };
    writeFileSync(scenario, JSON.stringify({ turns: [{ steps: [step], result: "ok", tokens: 0 }] }));
    const h = setup({
      scenario: "hold",
      profiles: [demo],
      demoProject: true,
      demoAgent: {
        bin: FAKE_CLAUDE,
        env: () => ({ KIBO_FAKE_CLAUDE_SCENARIO: scenario, KIBO_FAKE_CLAUDE_FIXTURES: files }),
      },
    });
    const r = h.orch.assign({ projectId: "p1", ticketId: "t1", profileId: "demo", brief: "" });
    await waitUntil(() => run(h, r.id).state === "done");
    expect(existsSync(join(h.home, "runs", "escape.md"))).toBe(false);
    const exited = h.orch.log(r.id).flatMap((e) => (e.event.type === "exited" ? [e.event] : []));
    expect(exited.at(-1)?.denied).toEqual(["Write"]);
  } finally {
    rmSync(files, { recursive: true, force: true });
  }
}, 30_000);
