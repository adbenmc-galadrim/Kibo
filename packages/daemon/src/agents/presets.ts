import {
  type Agent,
  type AgentPresetId,
  type AgentRef,
  type AgentSettings,
  type AgentSettingsPatch,
  applyPreset,
  isDeliveryRequest,
  KiboError,
  parseAgentRef,
  presetPatch,
} from "@kibo/schema";
import { type RpcExtension, requireLocal } from "../rpc-extensions";
import { assertAddDirs } from "../runs/add-dirs";

export type PresetTarget = {
  read(ref: AgentRef): Agent;
  settings(ref: AgentRef, patch: AgentSettingsPatch): AgentSettings;
};

export function applyAgentPreset(
  service: PresetTarget,
  ref: AgentRef,
  preset: AgentPresetId,
  home: string,
): Agent {
  if (parseAgentRef(ref).scope === "system")
    throw new KiboError("INVALID_INPUT", "a Kibo agent does not take a preset");
  const patch = presetPatch(preset, home);
  const next = applyPreset(service.read(ref).settings, patch);
  assertAddDirs(next.addDirs, home);
  service.settings(ref, { ...patch, allow: next.allow, addDirs: next.addDirs });
  return service.read(ref);
}

export type PresetRpcData = { home: string; assertWritable(projectId: string): void };

export function agentPresetRpc(service: PresetTarget, data: PresetRpcData): RpcExtension {
  return {
    methods: ["agents.applyPreset"],
    async handle(req, ctx) {
      if (!isDeliveryRequest(req) || req.method !== "agents.applyPreset")
        throw new KiboError("INTERNAL", `${req.method} is not a preset method`);
      requireLocal(ctx);
      const target = parseAgentRef(req.ref);
      if (target.scope === "project") data.assertWritable(target.projectId);
      return applyAgentPreset(service, req.ref, req.preset, data.home);
    },
  };
}
