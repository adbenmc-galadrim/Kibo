import type { DaemonOptions } from "./daemon-options";
import type { Closer } from "./daemon-shutdown";
import { defaultHookLauncher } from "./runs/hook-launcher";
import { createLoadSampler, readHostInfo } from "./runs/host-load";
import { createOrchestrator } from "./runs/orchestrator";
import type { Orchestrator, OrchestratorOptions } from "./runs/orchestrator-types";
import type { RunStore } from "./runs/run-store";
import type { Service } from "./service";

export type AgentsInput = {
  opts: DaemonOptions;
  runs: RunStore;
  service: Service;
  baseUrl(): string;
  projectTurns: OrchestratorOptions["projectTurns"];
  ready(orchestrator: Orchestrator): void;
};

export async function startAgents(input: AgentsInput, closers: Closer[]): Promise<Orchestrator> {
  const { opts, service } = input;
  const orchestrator = createOrchestrator({
    home: opts.home,
    store: input.runs,
    data: service.agentData,
    claudeBin: opts.claudeBin ?? null,
    hook: defaultHookLauncher(),
    baseUrl: input.baseUrl,
    sampler: opts.sampler ?? createLoadSampler(),
    hostInfo: readHostInfo(),
    notify: opts.notify ?? (() => {}),
    projectTurns: input.projectTurns,
    ...(opts.agentEnv && { env: opts.agentEnv }),
    ...(opts.userHome && { userHome: opts.userHome }),
  });
  closers.push(() => orchestrator.stop());
  input.ready(orchestrator);
  closers.push(service.attachAgents(orchestrator));
  return orchestrator;
}
