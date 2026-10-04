import {
  type BuiltinEntityType,
  type ComponentCall,
  covers,
  type FetchInit,
  type FetchResponse,
  type GrantedPermissions,
  type Instance,
  isBuiltinId,
  isReservedCommand,
  KiboError,
  type KiboErrorCode,
  type PresencePeer,
  type ProjectCommand,
  type ProjectSyncInfo,
  permissionList,
  permissionOfCall,
  splitRef,
} from "@kibo/schema";
import type { EventLog } from "./events";
import type { Quotas } from "./quotas";

export type FetchGrant = { net: readonly string[]; secrets: GrantedPermissions["secrets"] };
export type ActiveVersion = { ref: string; trust: "trusted" | "sandboxed"; granted: GrantedPermissions };
export type DataCall = Extract<
  ComponentCall,
  { kind: "data.get" | "data.set" | "data.delete" | "data.keys" }
>;
export type NotesCall =
  | Extract<ComponentCall, { kind: `notes.${string}` }>
  | { kind: "list"; entity: "note" };
export type McpCall = Extract<ComponentCall, { kind: `mcp.${string}` }>;
export type AssetsCall = Extract<ComponentCall, { kind: "assets.list" | "assets.url" }>;

export type GateHandlers = {
  list(projectId: string, entity: Exclude<BuiltinEntityType, "note">): Promise<unknown>;
  run(projectId: string, instanceId: string, command: ProjectCommand): Promise<unknown>;
  data(projectId: string, instanceId: string, call: DataCall): Promise<unknown>;
  fetch(grant: FetchGrant | null, url: string, init: FetchInit): Promise<FetchResponse>;
  action(
    ref: string,
    projectId: string,
    instanceId: string,
    config: Record<string, unknown>,
    name: string,
    input: unknown,
  ): Promise<unknown>;
  notes(projectId: string, call: NotesCall): Promise<unknown>;
  mcp(projectId: string, instanceId: string, call: McpCall): Promise<unknown>;
  assets(projectId: string, instanceId: string, call: AssetsCall): Promise<unknown>;
  presence(projectId: string): Promise<PresencePeer[]>;
  sharing(projectId: string): Promise<ProjectSyncInfo>;
};
export type GateDeps = {
  instance(projectId: string, instanceId: string): Instance;
  active(ref: string): ActiveVersion;
  handlers: GateHandlers;
  quotas: Quotas;
  events: EventLog;
};
export type Gate = { call(projectId: string, instanceId: string, call: ComponentCall): Promise<unknown> };

const REFUSALS = new Set<KiboErrorCode>([
  "NOT_FOUND",
  "TRUST_REQUIRED",
  "PERMISSION_DENIED",
  "RATE_LIMITED",
  "QUOTA_EXCEEDED",
  "PATH_OUTSIDE_PROJECT",
]);

export function missingPermission(granted: GrantedPermissions, call: ComponentCall): string | null {
  if (call.kind === "run" && isReservedCommand(call.command.method)) return `write:${call.command.method}`;
  const declared = permissionList(granted);
  const needed = permissionOfCall(call);
  if (needed !== null && !covers(declared, needed)) return needed;
  if (call.kind === "mcp.import" && !covers(declared, "write:ticket")) return "write:ticket";
  return null;
}

function dispatch(
  h: GateHandlers,
  projectId: string,
  inst: Instance,
  grant: FetchGrant | null,
  call: ComponentCall,
): Promise<unknown> {
  switch (call.kind) {
    case "list":
      return call.entity === "note"
        ? h.notes(projectId, { kind: "list", entity: "note" })
        : h.list(projectId, call.entity);
    case "run":
      return h.run(projectId, inst.id, call.command);
    case "data.get":
    case "data.set":
    case "data.delete":
    case "data.keys":
      return h.data(projectId, inst.id, call);
    case "fetch":
      return h.fetch(grant, call.url, call.init);
    case "action":
      return h.action(inst.component, projectId, inst.id, inst.config, call.name, call.input);
    case "mcp.call":
    case "mcp.read":
    case "mcp.import":
      return h.mcp(projectId, inst.id, call);
    case "presence.list":
      return h.presence(projectId);
    case "sharing.get":
      return h.sharing(projectId);
    case "assets.list":
    case "assets.url":
      return h.assets(projectId, inst.id, call);
    case "design.frame":
      throw new KiboError("NOT_CONNECTED", "design integrations not started");
    default:
      return h.notes(projectId, call);
  }
}

function fetchGrant(deps: GateDeps, ref: string, call: ComponentCall): FetchGrant | null {
  if (isBuiltinId(splitRef(ref).id)) return null;
  const active = deps.active(ref);
  const missing = missingPermission(active.granted, call);
  if (missing) throw new KiboError("PERMISSION_DENIED", `${ref} was not granted ${missing}`);
  return { net: active.granted.net, secrets: active.granted.secrets };
}

function takeQuotas(quotas: Quotas, instanceId: string, ref: string, call: ComponentCall): void {
  if (!quotas.take(instanceId, "call")) throw new KiboError("RATE_LIMITED", `${ref} makes too many calls`);
  if (call.kind === "fetch" && !quotas.take(instanceId, "fetch")) {
    throw new KiboError("RATE_LIMITED", `${ref} fetches too often`);
  }
  if (call.kind.startsWith("mcp.") && !quotas.take(instanceId, "mcp")) {
    throw new KiboError("RATE_LIMITED", `${ref} calls mcp servers too often`);
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
        located = true;
        ref = inst.component;
        if (call.kind === "run" && isReservedCommand(call.command.method)) {
          throw new KiboError("PERMISSION_DENIED", `${call.command.method} is not available to components`);
        }
        const grant = fetchGrant(deps, ref, call);
        takeQuotas(deps.quotas, instanceId, ref, call);
        return await dispatch(deps.handlers, projectId, inst, grant, call);
      } catch (e) {
        journal(e, located, projectId, instanceId, ref, call);
        throw e;
      }
    },
  };
}
