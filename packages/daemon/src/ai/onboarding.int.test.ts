import { afterEach, expect, test } from "bun:test";
import { type AiHarness, startAiHarness } from "./testing/harness";

let h: AiHarness | null = null;
afterEach(async () => {
  await h?.stop();
  h = null;
});

test("claude missing ⇒ AI_UNAVAILABLE", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json", claudeBin: "/nonexistent/claude" });
  expect(await h.rpc({ method: "getAiStatus" })).toMatchObject({ available: false, reason: "missing" });
  await expect(h.rpc({ method: "suggestStarter", role: "other", text: "x" })).rejects.toThrow(
    "AI_UNAVAILABLE",
  );
}, 30_000);

test("the Kibo agents are enabled at startup and the welcome screen reads its environment", async () => {
  h = await startAiHarness({ scenario: "onboarding-ok.json" });
  const env = await h.rpc({ method: "getEnvironment" });
  expect(env).toMatchObject({ ai: { available: true, profiles: { assistant: true, generateur: true } } });
  expect(env).toMatchObject({ github: { connected: false } });
  expect(env.daemon.home).toBe(h.home);
  expect(env.capacity.cores).toBeGreaterThan(0);
  expect(await h.rpc({ method: "listComponentDrafts" })).toEqual([]);
}, 30_000);
