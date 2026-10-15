import type { Database } from "bun:sqlite";
import { homedir } from "node:os";
import { listGuidelines } from "@kibo/core/agent-config";
import type { AgentRef } from "@kibo/schema";
import { type AgentFiles, startAgentFiles } from "./agent-files/bootstrap";
import { agentFilesRpc } from "./agent-files/rpc";
import { catalogAgentSource, type LateAgentSource } from "./agents/agent-source";
import type { Orchestrator } from "./agents/orchestrator-types";
import { agentPresetRpc } from "./agents/presets";
import { createAgentPreview } from "./agents/preview";
import type { RunStore } from "./agents/run-store";
import type { DaemonOptions } from "./daemon-options";
import type { Closer } from "./daemon-shutdown";
import { startVisibility, type Visibility } from "./moments/bootstrap";
import type { RpcExtension } from "./rpc-extensions";
import { call, type Service } from "./service";
import { type Skills, startSkills } from "./skills/bootstrap";

const refreshOnProjects = (service: Service, caches: { refresh(): Promise<void> }[]) =>
  service.onChange((message) => {
    if (!("projectId" in message) || message.projectId !== null) return;
    for (const cache of caches)
      cache.refresh().catch((e: unknown) => console.error("[kibo-daemon] agents refresh failed", e));
  });

const claudeEnv = (opts: DaemonOptions) => opts.agentEnv ?? process.env;

async function startDaemonAgentFiles(
  opts: DaemonOptions,
  input: { db: Database; runs: RunStore; service: Service; activeRuns(ref: AgentRef): number },
  closers: Closer[],
): Promise<AgentFiles> {
  const files = await startAgentFiles({
    home: opts.home,
    env: claudeEnv(opts),
    userHome: opts.userHome ?? homedir(),
    db: input.db,
    runs: input.runs,
    docs: input.service.docs,
    activeRuns: input.activeRuns,
  });
  closers.push(files.stop);
  return files;
}

async function startDaemonSkills(
  opts: DaemonOptions,
  input: { files: AgentFiles; service: Service; visibility: Visibility; late: LateAgentSource },
  closers: Closer[],
): Promise<{ skills: Skills; extensions: RpcExtension[] }> {
  const { files, service } = input;
  const data = {
    viewer: () => opts.user,
    assertWritable: (projectId: string) => service.docs.assertWritable(projectId),
    skillsRule: (ref: AgentRef) => files.catalog.byRef(ref)?.settings.skills ?? null,
  };
  const skills = await startSkills({
    roots: files.roots,
    env: claudeEnv(opts),
    projects: files.projects,
    history: files.history,
    uses: input.visibility.skills.uses,
    reviews: input.visibility.skills.reviews,
    agents: () => files.catalog.list(null),
    emit: () => service.docs.emit({ topic: "skills" }),
    data,
  });
  closers.push(skills.stop);
  closers.push(input.late.bind(catalogAgentSource(files.catalog, skills.service)));
  const preview = createAgentPreview({
    data: service.agentData,
    project: (projectId) => call(service, { method: "getProject", projectId }),
    workspaceGuidelines: () => listGuidelines(service.docs.workspace),
  });
  const home = opts.userHome ?? homedir();
  const restoreSkill = (id: string, baseHash: string | null, by: string) =>
    skills.service.restore(id, baseHash, by);
  return {
    skills,
    extensions: [
      agentFilesRpc(files.service, preview, { ...data, home, restoreSkill }),
      agentPresetRpc(files.service, { home, assertWritable: data.assertWritable }),
      skills.rpc,
    ],
  };
}

export type DaemonFilesInput = {
  db: Database;
  runs: RunStore;
  service: Service;
  late: LateAgentSource;
  agents(): Orchestrator | null;
};

export async function startDaemonFiles(
  opts: DaemonOptions,
  input: DaemonFilesInput,
  closers: Closer[],
): Promise<{ visibility: Visibility; extensions: RpcExtension[]; agentFiles: AgentFiles["service"] }> {
  const { service } = input;
  const activeRuns = (ref: AgentRef) => input.agents()?.activeRuns(ref) ?? 0;
  const files = await startDaemonAgentFiles(opts, { ...input, activeRuns }, closers);
  let skills: Skills | null = null;
  const visibility = startVisibility(opts, service.docs, input.agents, () => skills?.service ?? null);
  closers.push(visibility.close);
  const started = await startDaemonSkills(opts, { files, service, visibility, late: input.late }, closers);
  skills = started.skills;
  closers.push(refreshOnProjects(service, [files.catalog, started.skills.service]));
  return {
    visibility,
    extensions: [...started.extensions, visibility.subagentRpc],
    agentFiles: files.service,
  };
}
