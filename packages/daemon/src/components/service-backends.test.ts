import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Instance } from "@kibo/schema";
import {
  addInstance,
  boot,
  createProject,
  fakeTimers,
  type Harness,
  type HarnessOptions,
  publishAndApprove,
  writeDraft,
} from "./service.test-helper";

const COUNTER = `
let calls = 0;
module.exports.server = {
  actions: { count: async () => { calls += 1; return calls; } },
  jobs: { sync: { everyMinutes: 5, run: async () => undefined } },
};
`;
const FAILING_MIGRATION = `
module.exports.migrations = { 1: { config: () => { throw new Error("the old layout is unreadable"); } } };
`;

let home: string;
let h: Harness;

const start = async (opts: HarnessOptions = {}) => {
  h = await boot(home, opts);
};
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-backends-"));
  await start();
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

const count = (projectId: string, inst: Instance) =>
  h.rpc({
    method: "componentCall",
    projectId,
    instanceId: inst.id,
    call: { kind: "action", name: "count", input: null },
  });
const tamper = (hash: string, file: string) => {
  const path = join(home, "components", "store", "hello", "0.1.0", hash, "build", file);
  chmodSync(path, 0o600);
  writeFileSync(path, "evil");
};
const versionOf = async (version: string) => {
  const list = await h.rpc({ method: "listComponents" });
  return list.find((c) => c.id === "hello")?.versions.find((v) => v.version === version);
};

describe("store integrity", () => {
  test("a store file changed while the daemon was off is caught at start", async () => {
    writeDraft(home, "0.1.0");
    const { hash } = await publishAndApprove(h);
    await h.stop();
    tamper(hash, "ui.sandbox.js");
    await start();
    expect(await versionOf("0.1.0")).toMatchObject({ tampered: true, active: false });
    expect(h.components.assets("hello", "0.1.0", hash)).toBeNull();
  });

  test("the store is checked again before a backend starts", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { server: COUNTER });
    const { hash } = await publishAndApprove(h, "trusted");
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    tamper(hash, "server.js");
    await expect(count(projectId, inst)).rejects.toThrow("TRUST_REQUIRED");
    expect(await versionOf("0.1.0")).toMatchObject({ tampered: true, active: false });
  });
});

describe("backend lifecycle", () => {
  test("a backend stops when its last instance is removed", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { server: COUNTER });
    await publishAndApprove(h, "trusted");
    const first = await addInstance(h, projectId, pageId, "hello@0.1.0");
    expect(await count(projectId, first)).toBe(1);
    expect(await count(projectId, first)).toBe(2);
    await h.rpc({
      method: "command",
      projectId,
      command: { method: "removeInstance", instanceId: first.id },
    });
    const second = await addInstance(h, projectId, pageId, "hello@0.1.0");
    expect(await count(projectId, second)).toBe(1);
  });

  test("a backend stops when its trust is withdrawn", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { server: COUNTER });
    await publishAndApprove(h, "trusted");
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    expect(await count(projectId, inst)).toBe(1);
    expect(await count(projectId, inst)).toBe(2);
    await h.rpc({ method: "revokeComponent", id: "hello", version: "0.1.0" });
    await expect(count(projectId, inst)).rejects.toThrow("TRUST_REQUIRED");
    await publishAndApprove(h, "trusted");
    expect(await count(projectId, inst)).toBe(1);
  });

  test("a backend stops when its instance moves to another version", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { server: COUNTER });
    await publishAndApprove(h, "trusted");
    writeDraft(home, "0.2.0", { server: COUNTER });
    await publishAndApprove(h, "trusted");
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    expect(await count(projectId, inst)).toBe(1);
    expect(await count(projectId, inst)).toBe(2);
    await h.rpc({ method: "updateInstance", projectId, instanceId: inst.id, to: "0.2.0" });
    await h.rpc({ method: "updateInstance", projectId, instanceId: inst.id, to: "0.1.0" });
    expect(await count(projectId, inst)).toBe(1);
  });

  test("jobs are scheduled once a version is approved", async () => {
    await h.stop();
    const timers = fakeTimers();
    await start({ timers });
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0", { server: COUNTER });
    await h.rpc({ method: "publishComponent", id: "hello", strategy: "new-version" });
    await addInstance(h, projectId, pageId, "hello@0.1.0");
    expect(timers.started).toEqual([]);
    await publishAndApprove(h, "trusted");
    const deadline = Date.now() + 5_000;
    while (timers.started.length === 0 && Date.now() < deadline) await Bun.sleep(20);
    expect(timers.started).toEqual(["300000"]);
  });

  test("a failed migration keeps its message under MIGRATION_FAILED", async () => {
    const { projectId, pageId } = await createProject(h);
    writeDraft(home, "0.1.0");
    await publishAndApprove(h, "trusted");
    writeDraft(home, "0.2.0", { configVersion: 1, migrations: FAILING_MIGRATION });
    await publishAndApprove(h, "trusted");
    const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
    const update = h.rpc({ method: "updateInstance", projectId, instanceId: inst.id, to: "0.2.0" });
    await expect(update).rejects.toThrow("MIGRATION_FAILED");
    await expect(update).rejects.toThrow("the old layout is unreadable");
  });
});
