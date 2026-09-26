import { describe, expect, test } from "bun:test";
import {
  createProjectDoc,
  executeProjectCommand,
  getInstance,
  readInstanceData,
  writeInstanceData,
} from "@kibo/core";
import { ComponentManifest, type Instance, type Page } from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";
import { type MigrateRequest, updateInstance } from "./update";

const manifest = (version: string, configVersion: number, configSchema?: Record<string, unknown>) =>
  ComponentManifest.parse({
    id: "hello",
    version,
    kind: "widget",
    title: "Hello",
    reads: [],
    writes: [],
    configVersion,
    configSchema,
  });

const MANIFESTS: Record<string, ComponentManifest> = {
  "hello@0.1.0": manifest("0.1.0", 0),
  "hello@0.1.5": manifest("0.1.5", 0),
  "hello@0.2.0": manifest("0.2.0", 2, {
    mode: { enum: ["compact", "full"], default: "full" },
    v: { type: "number" },
  }),
};

function setup(
  migrate?: (
    ref: string,
    req: MigrateRequest,
  ) => Promise<{ config: Record<string, unknown>; data: Record<string, unknown> }>,
) {
  const doc = createProjectDoc({ id: "p", key: "KIB", name: "Kibo", folder: null, color: "#71717A" });
  const page = executeProjectCommand(doc, { method: "addPage", title: "Board", kind: "dashboard" }) as Page;
  const inst = executeProjectCommand(doc, {
    method: "addInstance",
    pageId: page.id,
    component: "hello@0.1.0",
  }) as Instance;
  writeInstanceData(doc, inst.id, "count", 1);
  const persisted: string[] = [];
  const migrations: MigrateRequest[] = [];
  const deps = {
    doc: (): LoroDoc => doc,
    persist: (id: string) => persisted.push(id),
    manifestOf: async (ref: string) => {
      const m = MANIFESTS[ref];
      if (!m) throw new Error(`NOT_FOUND: ${ref}`);
      return m;
    },
    migrate:
      migrate ??
      (async (_ref: string, req: MigrateRequest) => {
        migrations.push(req);
        return {
          config: { ...req.config, mode: "compact", v: req.to },
          data: { ...req.data, migrated: true },
        };
      }),
    approvedHash: () => null,
  };
  return { doc, inst, deps, persisted, migrations };
}

describe("updateInstance", () => {
  test("same configVersion: the ref changes, nothing runs", async () => {
    const { doc, inst, deps, migrations, persisted } = setup();
    const next = await updateInstance(deps, "p", inst.id, "0.1.5");
    expect(next.component).toBe("hello@0.1.5");
    expect(migrations).toEqual([]);
    expect(persisted).toEqual(["p"]);
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 1 });
  });
  test("configVersion 0 → 2 migrates config and data in the target backend", async () => {
    const { doc, inst, deps, migrations } = setup();
    await updateInstance(deps, "p", inst.id, "0.2.0");
    expect(migrations).toEqual([
      { projectId: "p", instanceId: inst.id, from: 0, to: 2, config: {}, data: { count: 1 } },
    ]);
    expect(getInstance(doc, inst.id)).toMatchObject({
      component: "hello@0.2.0",
      config: { mode: "compact", v: 2 },
    });
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 1, migrated: true });
  });
  test("a failing or invalid migration leaves the instance unchanged", async () => {
    for (const migrate of [
      async () => {
        throw new Error("boom");
      },
      async () => ({ config: { mode: "weird" }, data: {} }),
      async () => ({ config: {}, data: { big: "x".repeat(300_000) } }),
      async () => ({ config: {}, data: { "bad key": 1 } }),
    ]) {
      const { doc, inst, deps, persisted } = setup(migrate);
      await expect(updateInstance(deps, "p", inst.id, "0.2.0")).rejects.toThrow("MIGRATION_FAILED");
      expect(getInstance(doc, inst.id).component).toBe("hello@0.1.0");
      expect(readInstanceData(doc, inst.id)).toEqual({ count: 1 });
      expect(persisted).toEqual([]);
    }
  });
  test("configVersion never goes down; a lower version with the same configVersion is fine", async () => {
    const { inst, deps } = setup();
    await updateInstance(deps, "p", inst.id, "0.2.0");
    await expect(updateInstance(deps, "p", inst.id, "0.1.5")).rejects.toThrow("INVALID_INPUT");
    const other = setup();
    await updateInstance(other.deps, "p", other.inst.id, "0.1.5");
    expect((await updateInstance(other.deps, "p", other.inst.id, "0.1.0")).component).toBe("hello@0.1.0");
  });
  test("an instance changed during the migration is a conflict", async () => {
    const holder: { doc?: LoroDoc; id?: string } = {};
    const { doc, inst, deps } = setup(async (_ref, req) => {
      executeProjectCommand(holder.doc as LoroDoc, {
        method: "setInstanceConfig",
        instanceId: holder.id ?? "",
        config: { v: 9 },
      });
      return { config: req.config, data: req.data };
    });
    holder.doc = doc;
    holder.id = inst.id;
    await expect(updateInstance(deps, "p", inst.id, "0.2.0")).rejects.toThrow("CONFLICT");
  });
  test("data written during the migration is a conflict", async () => {
    const holder: { doc?: LoroDoc; id?: string } = {};
    const { doc, inst, deps } = setup(async (_ref, req) => {
      writeInstanceData(holder.doc as LoroDoc, holder.id ?? "", "count", 2);
      return { config: req.config, data: req.data };
    });
    holder.doc = doc;
    holder.id = inst.id;
    await expect(updateInstance(deps, "p", inst.id, "0.2.0")).rejects.toThrow("CONFLICT");
    expect(readInstanceData(doc, inst.id)).toEqual({ count: 2 });
  });
  test("the active version: the instance is returned as is, nothing is persisted", async () => {
    const { inst, deps, migrations, persisted } = setup();
    const next = await updateInstance(deps, "p", inst.id, "0.1.0");
    expect(next).toEqual(inst);
    expect(migrations).toEqual([]);
    expect(persisted).toEqual([]);
  });
});
