import {
  type AgentProfile,
  type HostInfo,
  type HostLoad,
  type HostSettings,
  KiboError,
  type QueueEntry,
  type RunView,
  type WaitReason,
} from "@kibo/schema";

export type SchedulerProfile = Pick<AgentProfile, "id" | "name" | "maxParallel">;
export type SchedulerInput = {
  runs: RunView[];
  profiles: SchedulerProfile[];
  settings: HostSettings;
  load: HostLoad;
};
export type Admission = { runId: string; lane: number };
export type Plan = { admit: Admission[]; waiting: QueueEntry[] };

const holdsSlot = (r: Pick<RunView, "state">) => r.state === "starting" || r.state === "running";
const holdsLane = (r: Pick<RunView, "state">) => holdsSlot(r) || r.state === "waiting_input";

export function orderQueue(runs: RunView[]): RunView[] {
  return runs.filter((r) => r.state === "queued").sort((a, b) => a.rank - b.rank || a.seq - b.seq);
}

export function headRank(runs: RunView[]): number {
  const first = orderQueue(runs)[0];
  return first ? first.rank - 1 : 0;
}

export function tailRank(runs: RunView[]): number {
  return runs.length === 0 ? 0 : Math.max(...runs.map((r) => r.rank)) + 1;
}

export function rankForMove(runs: RunView[], runId: string, index: number): number {
  const target = runs.find((r) => r.id === runId);
  if (!target || target.state !== "queued") {
    throw new KiboError("INVALID_TRANSITION", `run ${runId} is not queued`);
  }
  const others = orderQueue(runs).filter((r) => r.id !== runId);
  const at = Math.min(index, others.length);
  const before = others[at - 1];
  const after = others[at];
  if (before && after) return (before.rank + after.rank) / 2;
  if (after) return after.rank - 1;
  if (before) return before.rank + 1;
  return target.rank;
}

export function defaultHostSlots(info: HostInfo): number {
  return Math.max(1, Math.min(8, Math.floor(info.cores / 2), Math.floor(info.ramGb / 5)));
}

function globalReason(settings: HostSettings, load: HostLoad): WaitReason | null {
  if (settings.paused) return { kind: "paused" };
  if (load.cpu >= settings.cpuThreshold) {
    return { kind: "cpu", value: Math.round(load.cpu), threshold: settings.cpuThreshold };
  }
  if (load.ram >= settings.ramThreshold) {
    return { kind: "ram", value: Math.round(load.ram), threshold: settings.ramThreshold };
  }
  return null;
}

function freeLane(holders: Pick<RunView, "profileId" | "state" | "lane">[], profileId: string): number {
  const taken = new Set(
    holders.filter((r) => r.profileId === profileId && holdsLane(r) && r.lane !== null).map((r) => r.lane),
  );
  let lane = 1;
  while (taken.has(lane)) lane += 1;
  return lane;
}

export function planAdmissions(input: SchedulerInput): Plan {
  const { settings } = input;
  const holders: Pick<RunView, "profileId" | "state" | "lane">[] = [...input.runs];
  let hostUsed = input.runs.filter(holdsSlot).length;
  const perProfile = new Map<string, number>();
  for (const r of input.runs) {
    if (holdsSlot(r)) perProfile.set(r.profileId, (perProfile.get(r.profileId) ?? 0) + 1);
  }
  const blocked = globalReason(settings, input.load);
  const admit: Admission[] = [];
  const waiting: QueueEntry[] = [];
  for (const run of orderQueue(input.runs)) {
    const profile = input.profiles.find((p) => p.id === run.profileId);
    const used = perProfile.get(run.profileId) ?? 0;
    let reason: WaitReason | null = blocked;
    if (!reason && !profile) reason = { kind: "profile_missing" };
    if (!reason && profile && used >= profile.maxParallel) {
      reason = { kind: "profile", profileName: profile.name, used, total: profile.maxParallel };
    }
    if (!reason && hostUsed >= settings.hostSlots) {
      reason = { kind: "host", used: hostUsed, total: settings.hostSlots };
    }
    if (reason) {
      waiting.push({ runId: run.id, position: waiting.length + 1, reason });
      continue;
    }
    const lane = freeLane(holders, run.profileId);
    holders.push({ profileId: run.profileId, state: "starting", lane });
    admit.push({ runId: run.id, lane });
    hostUsed += 1;
    perProfile.set(run.profileId, used + 1);
  }
  return { admit, waiting };
}
