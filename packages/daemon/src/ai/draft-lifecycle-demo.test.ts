import { expect, test } from "bun:test";
import { cleanLifecycles, create, report, setupLifecycle } from "./testing/lifecycle-fixture";

cleanLifecycles();

const withoutClaude = { available: false, reason: "missing" as const };

test("a draft of the demo project runs on the demo agent without claude, for every launch", async () => {
  const { life, runs } = setupLifecycle({
    status: { ...withoutClaude, profiles: { assistant: false, generateur: false } },
    demoProjects: ["p-demo"],
    reports: [report(false)],
  });
  const started = await life.start({ ...create, projectId: "p-demo" });
  expect(started.projectId).toBe("p-demo");
  expect(runs.runs[0]?.req.profileId).toBe("demo");
  runs.end(runs.runs[0]?.id ?? "", { state: "done", sessionId: "s1", stdout: "", error: null });
  await life.idle();
  life.retry(started.id);
  expect(runs.runs.map((r) => r.req.profileId)).toEqual(["demo", "demo"]);
});

test("without claude an ordinary draft is refused, with or without a project", async () => {
  const { life, store } = setupLifecycle({ status: withoutClaude, demoProjects: ["p-demo"] });
  await expect(life.start(create)).rejects.toThrow("AI_UNAVAILABLE");
  await expect(life.start({ ...create, projectId: "p-work" })).rejects.toThrow("AI_UNAVAILABLE");
  expect(store.list()).toEqual([]);
});

test("a demo draft still needs the toolchain", async () => {
  const { life } = setupLifecycle({ status: withoutClaude, demoProjects: ["p-demo"], withoutSdk: true });
  await expect(life.start({ ...create, projectId: "p-demo" })).rejects.toThrow("@kibo/sdk");
});
