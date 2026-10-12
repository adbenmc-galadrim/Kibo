import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type AgentContext, launchFlags, skillAllowRule, subagentsJson } from "@kibo/core/agents/compose";
import { type BriefInput, buildRunContext, buildSystemPrompt, type ContextFile } from "@kibo/core/context";
import {
  AGENT_BODY_MAX,
  type Agent,
  type AgentFile,
  type AgentRef,
  type Guideline,
  KiboError,
  type QuestionRecipient,
  type RunView,
  type Skill,
  type SkillsRule,
} from "@kibo/schema";
import { agentGuardOf } from "./agent-guard";
import type { AgentFlags, CliFallbacks } from "./cli-flags";
import type { AgentDataPort, ToolGuard } from "./orchestrator-types";
import { writeRunContext } from "./workspace-prep";

export type AgentLookup = Pick<AgentDataPort, "agentOf" | "skills">;
export type LaunchFlags = ReturnType<typeof launchFlags>;

export type ComposedAgent = {
  agent: Agent;
  context: AgentContext;
  subagents: { name: string; file: AgentFile }[];
  agentsJson: string | null;
  flags: LaunchFlags;
  skillReview: boolean;
};

export type TurnContent =
  | { kind: "ticket"; brief: BriefInput; chain: Guideline[]; recipients: readonly QuestionRecipient[] }
  | { kind: "task"; brief: string }
  | { kind: "project"; systemPrompt: string; brief: string };

export type PreparedTurn = {
  systemPromptFile: string;
  briefFile: string;
  brief: string;
  agentsFile: string | null;
  flags: LaunchFlags;
  agentFlags: AgentFlags;
  promptTitle: string | null;
  guard: ToolGuard;
  agent: Agent;
};

const AGENTS_FILE = "agents.json";

function mainAgent(data: AgentLookup, ref: AgentRef): Agent {
  const agent = data.agentOf(ref);
  if (!agent) throw new KiboError("AGENT_NOT_FOUND", `agent ${ref} not found`);
  if (agent.file === null && agent.scope !== "system")
    throw new KiboError("INVALID_INPUT", `agent ${agent.name} has an unreadable file`);
  return agent;
}

function subagentOf(data: AgentLookup, ref: AgentRef, projectId: string | null) {
  const found = data.agentOf(ref);
  const foreign = found?.scope === "project" && found.projectId !== projectId;
  if (!found || found.file === null || foreign)
    throw new KiboError("AGENT_NOT_FOUND", `subagent ${ref} not found`);
  return { name: found.name, file: found.file };
}

function skillEntries(rule: SkillsRule, known: readonly Skill[]): AgentContext["skills"] {
  if (rule.mode === "all") return { mode: "all" };
  const description = (id: string) => known.find((s) => s.id === id)?.description ?? "";
  return { mode: "list", entries: rule.ids.map((id) => ({ id, description: description(id) })) };
}

export function composeAgent(data: AgentLookup, ref: AgentRef, projectId: string | null): ComposedAgent {
  const agent = mainAgent(data, ref);
  const subagents = agent.settings.subagents.map((sub) => subagentOf(data, sub, projectId));
  const { skills } = agent.settings;
  const context: AgentContext = {
    name: agent.name,
    body: agent.file?.body ?? "",
    subagents: subagents.map((s) => ({ name: s.name, description: s.file.frontmatter.description })),
    skills: skillEntries(skills, data.skills(projectId)),
    preloaded: agent.file?.frontmatter.skills ?? [],
  };
  return {
    agent,
    context,
    subagents,
    agentsJson: subagents.length === 0 ? null : subagentsJson(subagents),
    flags: launchFlags(agent.file?.frontmatter ?? null, agent.settings),
    skillReview: skills.mode === "all" || skills.ids.length > 0,
  };
}

export function skillRules(rule: SkillsRule, withArgs: boolean): string[] {
  if (rule.mode === "all") return [];
  return rule.ids.flatMap((id) => (withArgs ? [skillAllowRule(id), `Skill(${id} *)`] : [skillAllowRule(id)]));
}

function contextFiles(composed: ComposedAgent, content: TurnContent): ContextFile[] {
  switch (content.kind) {
    case "ticket":
      return buildRunContext({
        ...content.brief,
        chain: content.chain,
        agent: composed.context,
        protocol: {
          progress: true,
          recipients: content.recipients,
          signals: true,
          skillReview: composed.skillReview,
        },
      }).files;
    case "task":
      return [
        { path: "CLAUDE.md", content: buildSystemPrompt([], composed.context) },
        { path: "brief.md", content: content.brief },
      ];
    case "project":
      return [
        { path: "CLAUDE.md", content: content.systemPrompt },
        { path: "brief.md", content: content.brief },
      ];
  }
}

function inlineAgents(composed: ComposedAgent): string {
  const long = composed.subagents.find((s) => s.file.body.length > AGENT_BODY_MAX);
  if (long) throw new KiboError("INVALID_INPUT", `subagent ${long.name} is too long for the command line`);
  return composed.agentsJson ?? "{}";
}

function writeAgents(runDir: string, composed: ComposedAgent): string | null {
  const file = join(runDir, AGENTS_FILE);
  if (composed.agentsJson === null) {
    rmSync(file, { force: true });
    return null;
  }
  writeFileSync(file, composed.agentsJson, { mode: 0o600 });
  return file;
}

const briefOf = (files: ContextFile[]) => files.find((f) => f.path === "brief.md")?.content ?? "";

export function createTurnPreparer(deps: { data: AgentLookup; fallbacks: CliFallbacks }) {
  const { fallbacks } = deps;
  return {
    prepare(run: RunView, runDir: string, content: TurnContent): PreparedTurn {
      const composed = composeAgent(deps.data, run.profileId, run.projectId);
      const agents = fallbacks.agentsInline && composed.agentsJson !== null ? inlineAgents(composed) : null;
      const files = contextFiles(composed, content);
      const { systemPromptFile, briefFile } = writeRunContext(runDir, files);
      const agentsFile = writeAgents(runDir, composed);
      const { flags } = composed;
      return {
        systemPromptFile,
        briefFile,
        brief: briefOf(files),
        agentsFile,
        flags,
        agentFlags: {
          name: fallbacks.nameInPrompt ? null : run.label,
          agents: agents ?? agentsFile,
          tools: flags.tools,
          disallowedTools: flags.disallowedTools,
          skillRules: skillRules(composed.agent.settings.skills, fallbacks.skillArgsRule),
          fallbacks,
        },
        promptTitle: fallbacks.nameInPrompt ? `# ${run.label}` : null,
        guard: agentGuardOf(composed.agent),
        agent: composed.agent,
      };
    },
  };
}
