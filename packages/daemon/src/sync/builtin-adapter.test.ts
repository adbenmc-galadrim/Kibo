import { afterAll, afterEach, beforeAll, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ComponentManifest } from "@kibo/schema";
import { startFakeGithub } from "../testing/fake-github";
import { createAdapterHosts } from "./builtin-adapter";
import { openDaemonSide } from "./testing/daemon-fixture";

const manifest = ComponentManifest.parse({
  id: "github-issues",
  version: "1.0.0",
  kind: "adapter",
  title: "GitHub Issues",
  reads: ["ticket", "status"],
  writes: [],
  net: ["api.github.com"],
  secrets: [{ name: "github", hosts: ["api.github.com"] }],
});
const SERVER = `module.exports.server = { actions: {
  "adapter.pull": async () => ({ items: [], cursor: null, more: false }),
  "adapter.push": async () => { for (;;) {} },
} };`;
const HANGING_SERVER = `module.exports.server = { actions: {
  "adapter.pull": () => new Promise(() => {}),
  "adapter.push": async () => null,
} };`;

const RealWorker = globalThis.Worker;
const live = new Set<Worker>();
class CountingWorker extends RealWorker {
  constructor(...args: ConstructorParameters<typeof Worker>) {
    super(...args);
    live.add(this);
    this.addEventListener("close", () => live.delete(this));
  }
  override terminate() {
    live.delete(this);
    return super.terminate();
  }
}
beforeAll(() => {
  globalThis.Worker = CountingWorker;
});
afterAll(() => {
  globalThis.Worker = RealWorker;
});
afterEach(() => {
  for (const w of live) w.terminate();
  live.clear();
});

const req = (action: "adapter.pull" | "adapter.push", bindingId = "b1") => ({
  projectId: "p1",
  bindingId,
  adapter: "github-issues" as const,
  config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
  action,
  input: { cursor: null },
});
const hosts = (loadDelayMs = 0, timeoutMs = 60_000, server = SERVER) =>
  createAdapterHosts({
    load: async () => {
      await Bun.sleep(loadDelayMs);
      return { manifest, server };
    },
    calls: () => async () => null,
    timeoutMs,
  });

test("a frozen adapter is terminated by the invocation timeout", async () => {
  const h = hosts(0, 300);
  await h.invoke(req("adapter.pull"));
  expect(live.size).toBe(1);
  const error = await h.invoke(req("adapter.push")).catch((e: unknown) => e);
  expect(String(error)).toContain("TIMEOUT");
  expect(live.size).toBe(0);
  h.stop();
});

test("stop terminates the running adapter worker", async () => {
  const h = hosts();
  await h.invoke(req("adapter.pull"));
  expect(live.size).toBe(1);
  h.stop();
  await Bun.sleep(20);
  expect(live.size).toBe(0);
});

test("an invocation after stop is refused and spawns no worker", async () => {
  const h = hosts();
  h.stop();
  const error = await h.invoke(req("adapter.pull")).catch((e: unknown) => e);
  await Bun.sleep(20);
  expect(String(error)).toContain("COMPONENT_CRASHED");
  expect(live.size).toBe(0);
});

test("an invocation racing with stop while the adapter loads leaves no worker", async () => {
  const h = hosts(50);
  const pending = h.invoke(req("adapter.pull")).catch((e: unknown) => e);
  await Bun.sleep(10);
  h.stop();
  expect(String(await pending)).toContain("COMPONENT_CRASHED");
  await Bun.sleep(50);
  expect(live.size).toBe(0);
});

test("an invocation racing with stop after the load leaves no worker", async () => {
  const h = hosts();
  const pending = h.invoke(req("adapter.pull")).catch((e: unknown) => e);
  await Promise.resolve();
  h.stop();
  await pending;
  await Bun.sleep(50);
  expect(live.size).toBe(0);
});

test("an invocation queued behind busy slots does not restart the worker after stop", async () => {
  const h = hosts(0, 60_000, HANGING_SERVER);
  const all = ["b1", "b2", "b3", "b4", "b5"].map((b) =>
    h.invoke(req("adapter.pull", b)).catch((e: unknown) => String(e)),
  );
  await Bun.sleep(300);
  expect(live.size).toBe(1);
  h.stop();
  const outcomes = await Promise.all(all);
  await Bun.sleep(300);
  expect(outcomes.map(String).every((o) => o.includes("COMPONENT_CRASHED"))).toBe(true);
  expect(live.size).toBe(0);
});

test("closing the daemon during the first cycle of a new binding leaves no adapter worker", async () => {
  const gh = startFakeGithub();
  gh.addRepo("adam/kibo");
  for (let i = 0; i < 3; i++) gh.addIssue("adam/kibo", { title: `I${i}` });
  const home = mkdtempSync(join(tmpdir(), "kibo-close-"));
  try {
    const daemon = openDaemonSide(home, gh, () => Date.now());
    const project = await daemon.rpc({
      method: "createProject",
      name: "Kibo",
      key: "KIB",
      folder: null,
      color: "#71717A",
    });
    await daemon.rpc({ method: "connectGithub", auth: { mode: "token", token: gh.token } });
    await daemon.rpc({
      method: "createBinding",
      projectId: project.id,
      config: { repo: "adam/kibo", project: null, importClosed: false, labels: [] },
    });
    daemon.close();
    await Bun.sleep(1_500);
    expect(live.size).toBe(0);
  } finally {
    gh.stop();
    rmSync(home, { recursive: true, force: true });
  }
});
