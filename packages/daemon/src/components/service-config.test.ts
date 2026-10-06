import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getInstance } from "@kibo/core";
import { addInstance, boot, createProject, type Harness } from "./service.test-helper";

let home: string;
let h: Harness;
beforeEach(async () => {
  home = mkdtempSync(join(tmpdir(), "kibo-config-rpc-"));
  h = await boot(home);
});
afterEach(async () => {
  await h.stop();
  rmSync(home, { recursive: true, force: true });
});

test("a built-in component writes its own declared settings and nothing else", async () => {
  const { projectId, pageId } = await createProject(h);
  const mine = await addInstance(h, projectId, pageId, "viewer-3d@1.0.0");
  const other = await addInstance(h, projectId, pageId, "viewer-3d@1.0.0");
  const configOf = (id: string) => getInstance(h.service.docs.project(projectId), id).config;
  const before = configOf(other.id);
  const set = (patch: Record<string, unknown>) =>
    h.rpc({ method: "componentCall", projectId, instanceId: mine.id, call: { kind: "config.set", patch } });

  expect(await set({ autoRotate: false })).toBeNull();
  expect(configOf(mine.id)).toEqual({ ...mine.config, autoRotate: false });
  await expect(set({ ghost: 1 })).rejects.toThrow("INVALID_INPUT");
  await expect(set({ autoRotate: "no" })).rejects.toThrow("INVALID_INPUT");
  await expect(set({ model: "../secret.glb" })).rejects.toThrow("INVALID_INPUT");
  expect(configOf(mine.id)).toEqual({ ...mine.config, autoRotate: false });
  expect(configOf(other.id)).toEqual(before);
});
