import { assertInstanceData, getInstance, readInstanceData, setInstanceComponent } from "@kibo/core";
import {
  type ComponentManifest,
  formatRef,
  type Instance,
  KiboError,
  splitRef,
  validateConfig,
} from "@kibo/schema";
import type { LoroDoc } from "loro-crdt";

type Json = Record<string, unknown>;
export type MigrateRequest = {
  projectId: string;
  instanceId: string;
  from: number;
  to: number;
  config: Json;
  data: Json;
};
export type UpdateDeps = {
  doc(projectId: string): LoroDoc;
  persist(projectId: string): void;
  manifestOf(ref: string): Promise<ComponentManifest>;
  migrate(targetRef: string, req: MigrateRequest): Promise<{ config: Json; data: Json }>;
};

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

function assertMigratedData(target: string, data: Json): void {
  try {
    assertInstanceData(data);
  } catch (e) {
    throw new KiboError("MIGRATION_FAILED", `${target}: invalid data (${message(e)})`);
  }
}

function changedSince(doc: LoroDoc, before: Instance, beforeData: Json | null): boolean {
  const current = getInstance(doc, before.id);
  if (current.component !== before.component) return true;
  if (JSON.stringify(current.config) !== JSON.stringify(before.config)) return true;
  return (
    beforeData !== null && JSON.stringify(readInstanceData(doc, before.id)) !== JSON.stringify(beforeData)
  );
}

export async function updateInstance(
  deps: UpdateDeps,
  projectId: string,
  instanceId: string,
  to: string,
): Promise<Instance> {
  const doc = deps.doc(projectId);
  const before = getInstance(doc, instanceId);
  const beforeData = readInstanceData(doc, instanceId);
  const { id, version } = splitRef(before.component);
  if (version === to) return before;
  const target = formatRef(id, to);
  const [source, next] = await Promise.all([deps.manifestOf(before.component), deps.manifestOf(target)]);
  if (next.configVersion < source.configVersion) {
    throw new KiboError("INVALID_INPUT", `${target} has an older config version than ${before.component}`);
  }
  let config: Json = before.config;
  let data: Json | null = null;
  if (next.configVersion > source.configVersion) {
    try {
      const out = await deps.migrate(target, {
        projectId,
        instanceId,
        from: source.configVersion,
        to: next.configVersion,
        config: before.config,
        data: beforeData,
      });
      config = out.config;
      data = out.data;
    } catch (e) {
      throw new KiboError("MIGRATION_FAILED", `${target}: ${message(e)}`);
    }
  }
  const errors = validateConfig(next.configSchema, config);
  if (errors.length > 0)
    throw new KiboError("MIGRATION_FAILED", `${target}: invalid config (${errors.join("; ")})`);
  if (data !== null) assertMigratedData(target, data);
  if (changedSince(doc, before, data === null ? null : beforeData)) {
    throw new KiboError("CONFLICT", `instance ${instanceId} changed during the update`);
  }
  const updated = setInstanceComponent(doc, { instanceId, component: target, config, data });
  deps.persist(projectId);
  return updated;
}
