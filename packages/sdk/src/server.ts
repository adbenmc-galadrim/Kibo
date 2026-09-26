import { KiboError } from "@kibo/schema";
import type { InstanceData, KiboSdk } from "./types";

export type ServerContext = {
  instanceId: string;
  config: Record<string, unknown>;
  list: KiboSdk["list"];
  run: KiboSdk["run"];
  data: InstanceData;
  fetch: KiboSdk["fetch"];
};
export type ServerAction = (ctx: ServerContext, input: unknown) => Promise<unknown>;
export type ServerJob = { everyMinutes: number; run: (ctx: ServerContext) => Promise<void> };
export type ServerDefinition = {
  actions?: Record<string, ServerAction>;
  jobs?: Record<string, ServerJob>;
};

export function defineServer(def: ServerDefinition): ServerDefinition {
  for (const [name, job] of Object.entries(def.jobs ?? {})) {
    if (!Number.isInteger(job.everyMinutes) || job.everyMinutes < 1) {
      throw new KiboError("INVALID_INPUT", `job ${name}: everyMinutes must be an integer >= 1`);
    }
  }
  return def;
}
