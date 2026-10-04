import { afterEach, expect, test } from "bun:test";
import { fakeCalls } from "../agents/fake-claude-scenario";
import { type AiHarness, startAiHarness } from "./testing/harness";

let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

const ready = (runId: string) => (e: object) =>
  "type" in e && e.type === "starter.ready" && "runId" in e && e.runId === runId;

test("valid JSON ⇒ plan, and the assistant runs without tools nor skipped permissions", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json" });
  expect(await h.rpc({ method: "getAiStatus" })).toMatchObject({
    available: true,
    profiles: { assistant: true, generateur: true },
  });
  const { runId } = await h.rpc({ method: "suggestStarter", role: "other", text: "Je suis freelance" });
  expect(await h.waitFor(ready(runId))).toMatchObject({
    plan: { pages: [{ title: "Suivi clients" }, { title: "Tickets" }] },
  });
  const agents = await h.rpc({ method: "getAgents" });
  const sessionId = agents.runs.find((r) => r.id === runId)?.sessionId ?? "";
  const argv = fakeCalls(h.fakeState, sessionId)[0]?.argv ?? [];
  expect(argv).toContain("--tools");
  expect(argv[argv.indexOf("--tools") + 1]).toBe("");
  expect(argv).toContain("--json-schema");
  expect(argv.join(" ")).not.toContain("dangerously");
  expect(argv.join(" ")).not.toContain("bypassPermissions");
}, 30_000);

for (const [scenario, why] of [
  ["onboarding-invalid.json", "prose"],
  ["onboarding-unknown.json", "unknown component"],
  ["onboarding-slow.json", "timeout"],
] as const)
  test(`${why} ⇒ null plan (preset)`, async () => {
    h = await startAiHarness({ scenario });
    const { runId } = await h.rpc({ method: "suggestStarter", role: "other", text: "x" });
    expect(await h.waitFor(ready(runId), 15_000)).toMatchObject({ plan: null });
  }, 30_000);

test("claude missing ⇒ AI_UNAVAILABLE", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: "/nonexistent/claude" });
  expect(await h.rpc({ method: "getAiStatus" })).toMatchObject({ available: false, reason: "missing" });
  await expect(h.rpc({ method: "suggestStarter", role: "other", text: "x" })).rejects.toThrow(
    "AI_UNAVAILABLE",
  );
}, 30_000);

test("the system profiles exist at startup and the welcome screen reads its environment", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json" });
  const config = await h.rpc({ method: "getConfig" });
  expect(
    config.profiles
      .filter((p) => p.system)
      .map((p) => p.id)
      .sort(),
  ).toEqual(["assistant", "demo", "generateur"]);
  const env = await h.rpc({ method: "getEnvironment" });
  expect(env).toMatchObject({ ai: { available: true }, github: { connected: false } });
  expect(env.daemon.home).toBe(h.home);
  expect(env.capacity.cores).toBeGreaterThan(0);
  expect(await h.rpc({ method: "listComponentDrafts" })).toEqual([]);
}, 30_000);
