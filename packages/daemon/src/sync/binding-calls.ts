import {
  type Binding,
  bindingIdOf,
  type ComponentCall,
  type ComponentManifest,
  type FetchInit,
  type FetchResponse,
  KiboError,
  type KiboErrorCode,
} from "@kibo/schema";
import type { EventLog as RefusalLog } from "../components/events";
import type { CallHandler } from "../components/host-core";
import type { Quotas } from "../components/quotas";

export const BINDING_FETCH_PER_MINUTE = 120;
const REFUSALS = new Set<KiboErrorCode>(["NOT_FOUND", "PERMISSION_DENIED", "RATE_LIMITED"]);

export type BindingCallsDeps = {
  bindings(projectId: string): Binding[];
  manifest: ComponentManifest;
  quotas: Quotas;
  refusals: RefusalLog;
  fetch(manifest: ComponentManifest, url: string, init: FetchInit): Promise<FetchResponse>;
};

export function createBindingCalls(deps: BindingCallsDeps): CallHandler {
  const ref = `${deps.manifest.id}@${deps.manifest.version}`;
  const guarded = async (
    projectId: string,
    instanceId: string,
    call: ComponentCall,
  ): Promise<FetchResponse> => {
    const bindingId = bindingIdOf(instanceId);
    if (!deps.bindings(projectId).some((b) => b.id === bindingId))
      throw new KiboError("NOT_FOUND", `binding ${bindingId} not found`);
    if (call.kind !== "fetch")
      throw new KiboError("PERMISSION_DENIED", `adapters may only fetch, not ${call.kind}`);
    if (!deps.quotas.take(instanceId, "call") || !deps.quotas.take(instanceId, "fetch"))
      throw new KiboError("RATE_LIMITED", `${instanceId} fetches too often`);
    return deps.fetch(deps.manifest, call.url, call.init);
  };
  return async (projectId, instanceId, call) => {
    try {
      return await guarded(projectId, instanceId, call);
    } catch (e) {
      if (e instanceof KiboError && REFUSALS.has(e.code))
        deps.refusals.record({ projectId, instanceId, ref, kind: call.kind, code: e.code });
      throw e;
    }
  };
}
