import { exampleTicket } from "@kibo/core/agents/compose";
import {
  buildRunContext,
  buildSystemPrompt,
  type ContextFile,
  FOLDER,
  guidelineChain,
  type RunProtocol,
} from "@kibo/core/context";
import { composeWorkSection } from "@kibo/core/overlaps/section";
import {
  type AgentPreview,
  type AgentRef,
  estimateTokens,
  type Guideline,
  KiboError,
  type ProjectDelivery,
  type ProjectSnapshot,
  type SettingOrigin,
} from "@kibo/schema";
import { EXAMPLE_NOW, exampleParallelWork } from "../overlaps/work-example";
import type { AgentDataPort } from "../runs/orchestrator-types";
import { type ComposedAgent, composeAgent, skillRules } from "../runs/run-prepare";

export type AgentPreviewRequest = { ref: AgentRef; projectId?: string; ticketId?: string };
export type AgentPreviewDeps = {
  data: Pick<AgentDataPort, "agentOf" | "skills" | "guidelines" | "ticketContext">;
  project(projectId: string): ProjectSnapshot;
  workspaceGuidelines(): Guideline[];
};

type Composition = {
  files: ContextFile[];
  systemPrompt: string;
  brief: string;
  delivery: ProjectDelivery | null;
};

const LEVEL_LABELS: [string, string][] = [
  [FOLDER.workspace, "Workspace"],
  [FOLDER.project, "Projet"],
  [FOLDER.domain, "Domaine"],
];

function levelLabel(path: string, agentName: string): string {
  const folder = path.split("/")[1] ?? "";
  if (folder === FOLDER.agent) return `Agent · ${agentName}`;
  return LEVEL_LABELS.find(([f]) => f === folder)?.[1] ?? folder;
}

const protocolOf = (composed: ComposedAgent, project: ProjectSnapshot | null): RunProtocol => ({
  progress: true,
  recipients: project?.questionRecipients ?? [],
  signals: true,
  skillReview: composed.skillReview,
  parallel: true,
});

function ticketOf(deps: AgentPreviewDeps, projectId: string, ticketId: string | undefined) {
  if (ticketId !== undefined) return deps.data.ticketContext(projectId, ticketId);
  const project = deps.project(projectId);
  return { project, ticket: exampleTicket(project), domain: null };
}

function projectComposition(
  deps: AgentPreviewDeps,
  composed: ComposedAgent,
  projectId: string,
  ticketId: string | undefined,
): Composition {
  const ctx = ticketOf(deps, projectId, ticketId);
  const chain = guidelineChain(deps.data.guidelines(projectId), {
    projectId,
    domainId: ctx.ticket.domainId,
  });
  const context = buildRunContext({
    ...ctx,
    note: "",
    work: composeWorkSection(exampleParallelWork(ctx.project), EXAMPLE_NOW),
    chain,
    agent: composed.context,
    protocol: protocolOf(composed, ctx.project),
  });
  return { ...context, delivery: ctx.project.meta.delivery };
}

function machineComposition(deps: AgentPreviewDeps, composed: ComposedAgent): Composition {
  const chain = deps.workspaceGuidelines().filter((g) => g.owner.scope === "workspace");
  const { context } = composed;
  const files = [
    ...chain.map((g) => ({ path: `context/${FOLDER.workspace}/${g.path}`, content: g.content })),
    ...(context.body.trim()
      ? [{ path: `context/${FOLDER.agent}/${context.name}.md`, content: context.body }]
      : []),
  ];
  const systemPrompt = buildSystemPrompt(chain, context, protocolOf(composed, null));
  return { files, systemPrompt, brief: "", delivery: null };
}

type Origined = { value: string; origin: SettingOrigin };
const from =
  (origin: SettingOrigin) =>
  (value: string): Origined => ({ value, origin });

function withOrigins(agent: readonly string[], project: readonly string[]): Origined[] {
  const seen = new Set(agent);
  const fromProject = [...new Set(project)].filter((value) => !seen.has(value));
  return [...agent.map(from("agent")), ...fromProject.map(from("project"))];
}

export function createAgentPreview(deps: AgentPreviewDeps) {
  return async (req: AgentPreviewRequest): Promise<AgentPreview> => {
    const agent = deps.data.agentOf(req.ref);
    if (!agent) throw new KiboError("AGENT_NOT_FOUND", `agent ${req.ref} not found`);
    const projectId = req.projectId ?? agent.projectId;
    const composed = composeAgent(deps.data, req.ref, projectId);
    const composition =
      projectId === null
        ? machineComposition(deps, composed)
        : projectComposition(deps, composed, projectId, req.ticketId);
    const { flags } = composed;
    const { settings } = agent;
    const { delivery } = composition;
    const allow = [
      ...withOrigins(settings.allow, delivery?.allow ?? []),
      ...skillRules(settings.skills, false).map(from("agent")),
    ];
    return {
      levels: composition.files
        .filter((f) => f.path.startsWith("context/"))
        .map((f) => ({
          label: levelLabel(f.path, agent.name),
          path: f.path,
          tokens: estimateTokens(f.content),
        })),
      systemPrompt: composition.systemPrompt,
      brief: composition.brief,
      agentsJson: composed.agentsJson ?? "{}",
      command: {
        model: flags.model,
        permissionMode: settings.permissionMode,
        tools: flags.tools,
        disallowedTools: flags.disallowedTools,
        allow: allow.map((o) => o.value),
        allowOrigins: allow.map(({ value, origin }) => ({ rule: value, origin })),
        addDirs: withOrigins(settings.addDirs, delivery?.addDirs ?? []).map(({ value, origin }) => ({
          dir: value,
          origin,
        })),
        subagents: composed.subagents.map((s) => s.name),
        allSubagents: settings.allSubagents,
        skills: settings.skills,
      },
    };
  };
}
