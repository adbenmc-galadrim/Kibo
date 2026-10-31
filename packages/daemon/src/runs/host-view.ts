import { defaultHostSlots } from "@kibo/core/scheduler";
import {
  DEFAULT_CPU_THRESHOLD,
  DEFAULT_RAM_THRESHOLD,
  type HostInfo,
  type HostLoad,
  type HostSettings,
  type HostView,
  type RunView,
} from "@kibo/schema";
import { holdsSlot } from "./orchestrator-support";
import type { RunStore } from "./run-store";

export function hostSettingsOf(store: RunStore, hostInfo: HostInfo): HostSettings {
  return {
    hostSlots: defaultHostSlots(hostInfo),
    cpuThreshold: DEFAULT_CPU_THRESHOLD,
    ramThreshold: DEFAULT_RAM_THRESHOLD,
    paused: false,
    ...store.hostSettings(),
  };
}

export function hostViewOf(store: RunStore, hostInfo: HostInfo, runs: RunView[], load: HostLoad): HostView {
  return {
    ...hostSettingsOf(store, hostInfo),
    autoSlots: defaultHostSlots(hostInfo),
    slotsFixed: store.hostSettings().hostSlots !== undefined,
    cores: hostInfo.cores,
    ramGb: hostInfo.ramGb,
    used: runs.filter(holdsSlot).length,
    cpu: Math.round(load.cpu),
    ram: Math.round(load.ram),
  };
}
