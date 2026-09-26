import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ProjectSnapshot } from "@kibo/schema";
import {
  addInstance,
  boot,
  createProject,
  type Harness,
  publishAndApprove,
  writeDraft,
} from "./service.test-helper";

let home: string;
let h: Harness;

beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-hash-"));
  writeDraft(home, "0.1.0");
  h = await boot(home);
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

const snapshot = (projectId: string) =>
  h.rpc({ method: "getProject", projectId }) as Promise<ProjectSnapshot>;

test("adding a non builtin instance records its approved hash, builtins stay null", async () => {
  const { hash } = await publishAndApprove(h);
  const { projectId, pageId } = await createProject(h);
  const custom = await addInstance(h, projectId, pageId, "hello@0.1.0");
  const builtin = await addInstance(h, projectId, pageId, "kanban@1.0.0");
  const snap = await snapshot(projectId);
  expect(snap.instances.find((i) => i.id === custom.id)?.componentHash).toBe(hash);
  expect(snap.instances.find((i) => i.id === builtin.id)?.componentHash).toBeNull();
});

test("a hash sent by the caller is overwritten by the registry's", async () => {
  const { hash } = await publishAndApprove(h);
  const { projectId, pageId } = await createProject(h);
  const inst = await h.rpc({
    method: "command",
    projectId,
    command: { method: "addInstance", pageId, component: "hello@0.1.0", componentHash: "f".repeat(64) },
  });
  const snap = await snapshot(projectId);
  expect(snap.instances.find((i) => i.id === (inst as { id: string }).id)?.componentHash).toBe(hash);
});

test("updating an instance records the hash of the target version", async () => {
  await publishAndApprove(h);
  const { projectId, pageId } = await createProject(h);
  const inst = await addInstance(h, projectId, pageId, "hello@0.1.0");
  writeDraft(home, "0.2.0");
  const next = await publishAndApprove(h);
  await h.rpc({ method: "updateInstance", projectId, instanceId: inst.id, to: "0.2.0" });
  expect((await snapshot(projectId)).instances[0]?.componentHash).toBe(next.hash);
});
