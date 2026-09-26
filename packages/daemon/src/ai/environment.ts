import type { AiStatus, Environment } from "@kibo/schema";
import type { Exec } from "./ports";

const VERSION_TIMEOUT_MS = 5_000;

export type EnvironmentDeps = {
  daemon: { address: string; home: string };
  refreshAi: () => Promise<AiStatus>;
  exec: Exec;
  gitBin: string;
  ghBin: string;
  capacity: () => { cores: number; ramGb: number; hostSlots: number };
  githubConnected: () => Promise<boolean>;
};

export function parseToolVersion(out: string): string | null {
  const m = /(\d+)\.(\d+)/.exec(out);
  return m ? `${m[1]}.${m[2]}` : null;
}

async function toolVersion(exec: Exec, bin: string): Promise<string | null> {
  const r = await exec([bin, "--version"], VERSION_TIMEOUT_MS);
  return r && r.code === 0 ? parseToolVersion(r.stdout) : null;
}

export async function readEnvironment(deps: EnvironmentDeps): Promise<Environment> {
  const [ai, git, gh, connected] = await Promise.all([
    deps.refreshAi(),
    toolVersion(deps.exec, deps.gitBin),
    toolVersion(deps.exec, deps.ghBin),
    deps.githubConnected(),
  ]);
  return { daemon: deps.daemon, ai, git, gh, capacity: deps.capacity(), github: { connected } };
}
