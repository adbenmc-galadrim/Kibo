import { defaultHookLauncher } from "./agents/hook-launcher";
import { createLoadSampler, readHostInfo } from "./agents/host-load";
import { createOrchestrator } from "./agents/orchestrator";
import type { Orchestrator, OrchestratorOptions } from "./agents/orchestrator-types";
import type { RunStore } from "./agents/run-store";
import type { AgentsPort } from "./agents-rpc";
import { type AiBootstrapDeps, type StartedAi, startAi } from "./ai/bootstrap";
import type { RunSource } from "./collab/bootstrap";
import type { DaemonOptions } from "./daemon-options";
import type { Closer } from "./daemon-shutdown";
import { demoAgentBin } from "./demo/agent-bin";
import { demoAgentEnv } from "./demo/agent-env";
import { ensureDemoAgentFiles } from "./demo/agent-scenarios";
import type { Service } from "./service";
import { call } from "./service";

export type AgentsInput = {
  opts: DaemonOptions;
  runs: RunStore;
  service: Service;
  baseUrl(): string;
  port: number;
  projectTurns: OrchestratorOptions["projectTurns"];
  lifecycle: Pick<OrchestratorOptions, "onSpawned" | "onTurnEnd" | "onFailed" | "turnPrefix">;
  ready(orchestrator: Orchestrator): void;
  attachRuns(source: RunSource): Closer;
  agentsPort(orchestrator: Orchestrator): AgentsPort;
  ai: Pick<AiBootstrapDeps, "db" | "components" | "appInfo">;
};

export type StartedAgents = { orchestrator: Orchestrator; ai: StartedAi };

export async function startAgents(input: AgentsInput, closers: Closer[]): Promise<StartedAgents> {
  const { opts, service } = input;
  const orchestrator = createOrchestrator({
    home: opts.home,
    store: input.runs,
    data: service.agentData,
    claudeBin: opts.claudeBin ?? null,
    hook: defaultHookLauncher(),
    demoAgent: { bin: demoAgentBin(), env: () => demoAgentEnv(ensureDemoAgentFiles(opts.home)) },
    baseUrl: input.baseUrl,
    sampler: opts.sampler ?? createLoadSampler(),
    hostInfo: readHostInfo(),
    notify: opts.notify ?? (() => {}),
    projectTurns: input.projectTurns,
    ...(opts.agentEnv && { env: opts.agentEnv }),
    ...input.lifecycle,
  });
  closers.push(() => orchestrator.stop());
  input.ready(orchestrator);
  closers.push(input.attachRuns(orchestrator), service.attachAgents(input.agentsPort(orchestrator)));
  const ai = await startAi({
    home: opts.home,
    toolchain: opts.toolchain,
    db: input.ai.db,
    docs: service.docs,
    orchestrator,
    components: input.ai.components,
    validate: opts.validate ?? null,
    claudeBin: opts.claudeBin ?? null,
    agentEnv: opts.agentEnv ?? process.env,
    address: `127.0.0.1:${input.port}`,
    listIntegrations: async () => call(service, { method: "listIntegrations" }),
    appInfo: input.ai.appInfo,
    agentEnabled: (ref) => service.agentData.agentOf(ref)?.settings.enabled ?? false,
    ...(opts.assistantTimeoutMs !== undefined && { assistantTimeoutMs: opts.assistantTimeoutMs }),
  });
  closers.push(service.attachAi(ai.port));
  closers.push(() => ai.stop());
  return { orchestrator, ai };
}
