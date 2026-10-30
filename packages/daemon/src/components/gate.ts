import {
  type BuiltinEntityType,
  type ComponentCall,
  type ComponentSettings,
  type FetchInit,
  type FetchResponse,
  type Instance,
  isBuiltinId,
  isReservedCommand,
  KiboError,
  type KiboErrorCode,
  type ProjectCommand,
  type ProjectInfo,
  type QuestionRecipient,
  splitRef,
} from "@kibo/schema";
import type { EventLog } from "./events";
import type { Quotas } from "./quotas";

export type DataCall = Extract<
  ComponentCall,
  { kind: "data.get" | "data.set" | "data.delete" | "data.keys" }
>;
export type AssetsCall = Extract<ComponentCall, { kind: "assets.list" | "assets.url" }>;
export type DesignCall = Extract<ComponentCall, { kind: "design.frame" | "design.storybooks" }>;

export type GateHandlers = {
  list(projectId: string, entity: BuiltinEntityType, config?: Record<string, unknown>): Promise<unknown>;
  run(projectId: string, instanceId: string, command: ProjectCommand): Promise<unknown>;
  data(projectId: string, instanceId: string, call: DataCall): Promise<unknown>;
  fetch(url: string, init: FetchInit): Promise<FetchResponse>;
  assets(projectId: string, instanceId: string, call: AssetsCall): Promise<unknown>;
  design(projectId: string, instanceId: string, call: DesignCall): Promise<unknown>;
  config(projectId: string, instance: Instance, patch: Record<string, unknown>): Promise<null>;
  settings(projectId: string): Promise<ComponentSettings>;
  project(projectId: string): Promise<ProjectInfo>;
  recipients(projectId: string): Promise<QuestionRecipient[]>;
};
export type GateDeps = {
  instance(projectId: string, instanceId: string): Instance;
  handlers: GateHandlers;
  quotas: Quotas;
  events: EventLog;
};
export type Gate = { call(projectId: string, instanceId: string, call: ComponentCall): Promise<unknown> };

const REFUSALS = new Set<KiboErrorCode>([
  "NOT_FOUND",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "PATH_OUTSIDE_PROJECT",
]);

function dispatch(h: GateHandlers, projectId: string, inst: Instance, call: ComponentCall): Promise<unknown> {
  switch (call.kind) {
    case "list":
      return h.list(projectId, call.entity, inst.config);
    case "run":
      return h.run(projectId, inst.id, call.command);
    case "data.get":
    case "data.set":
    case "data.delete":
    case "data.keys":
      return h.data(projectId, inst.id, call);
    case "fetch":
      return h.fetch(call.url, call.init);
    case "action":
      throw new KiboError("NOT_FOUND", `${inst.component} has no backend`);
    case "settings.get":
      return h.settings(projectId);
    case "project.get":
      return h.project(projectId);
    case "assets.list":
    case "assets.url":
      return h.assets(projectId, inst.id, call);
    case "design.frame":
    case "design.storybooks":
      return h.design(projectId, inst.id, call);
    case "config.set":
      return h.config(projectId, inst, call.patch);
    case "questions.recipients":
      return h.recipients(projectId);
  }
}

function assertBuiltin(ref: string): void {
  if (!isBuiltinId(splitRef(ref).id)) throw new KiboError("NOT_FOUND", `${ref} is not a Kibo component`);
}

function takeQuotas(quotas: Quotas, instanceId: string, ref: string, call: ComponentCall): void {
  if (!quotas.take(instanceId, "call")) throw new KiboError("RATE_LIMITED", `${ref} makes too many calls`);
  if (call.kind === "fetch" && !quotas.take(instanceId, "fetch")) {
    throw new KiboError("RATE_LIMITED", `${ref} fetches too often`);
  }
  if (call.kind === "design.frame" && !quotas.take(instanceId, "design")) {
    throw new KiboError("RATE_LIMITED", `${ref} renders design frames too often`);
  }
}

export function createGate(deps: GateDeps): Gate {
  const journal = (
    e: unknown,
    located: boolean,
    projectId: string,
    instanceId: string,
    ref: string,
    call: ComponentCall,
  ) => {
    if (!(e instanceof KiboError) || !REFUSALS.has(e.code)) return;
    if (located && e.code === "NOT_FOUND") return;
    try {
      deps.events.record({ projectId, instanceId, ref, kind: call.kind, code: e.code });
    } catch (failure) {
      console.error("[kibo-daemon] component event not recorded", failure);
    }
  };

  return {
    async call(projectId, instanceId, call) {
      let ref = "unknown";
      let located = false;
      try {
        const inst = deps.instance(projectId, instanceId);
        ref = inst.component;
        assertBuiltin(ref);
        located = true;
        if (call.kind === "run" && isReservedCommand(call.command.method)) {
          throw new KiboError("PERMISSION_DENIED", `${call.command.method} is not available to components`);
        }
        takeQuotas(deps.quotas, instanceId, ref, call);
        return await dispatch(deps.handlers, projectId, inst, call);
      } catch (e) {
        journal(e, located, projectId, instanceId, ref, call);
        throw e;
      }
    },
  };
}
