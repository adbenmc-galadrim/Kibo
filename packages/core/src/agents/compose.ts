import {
  type AgentFile,
  type AgentFrontmatter,
  type AgentSettings,
  EMPTY_PROGRESS,
  KiboError,
  type ProjectSnapshot,
  type SkillId,
  SUBAGENTS_MAX,
  type TicketView,
} from "@kibo/schema";

export { DEFAULT_PROJECT_AGENT_BODY } from "../project-agent/prompt";

export type AgentContext = {
  name: string;
  body: string;
  subagents: { name: string; description: string }[];
  skills: { mode: "all" } | { mode: "list"; entries: { id: string; description: string }[] };
  preloaded: string[];
};

export const NO_AGENT: AgentContext = {
  name: "",
  body: "",
  subagents: [],
  skills: { mode: "all" },
  preloaded: [],
};

const DEFAULT_MODEL = "sonnet";
const INHERIT = "inherit";

export function runModel(frontmatter: Pick<AgentFrontmatter, "model"> | null): {
  model: string;
  inherited: boolean;
} {
  const model = frontmatter?.model;
  return model === undefined || model === INHERIT
    ? { model: DEFAULT_MODEL, inherited: true }
    : { model, inherited: false };
}

export type SubagentDefinition = { description: string; prompt: string; tools?: string[]; model?: string };

function definition(file: AgentFile): SubagentDefinition {
  const { description, tools, model } = file.frontmatter;
  return {
    description,
    prompt: file.body,
    ...(tools === undefined ? {} : { tools }),
    ...(model === undefined ? {} : { model }),
  };
}

export function subagentsJson(files: readonly { name: string; file: AgentFile }[]): string {
  if (files.length > SUBAGENTS_MAX) {
    throw new KiboError("INVALID_INPUT", `at most ${SUBAGENTS_MAX} callable subagents`);
  }
  if (files.length === 0) return "{}";
  return JSON.stringify(Object.fromEntries(files.map((f) => [f.name, definition(f.file)])), null, 2);
}

export const skillAllowRule = (id: SkillId): string => `Skill(${id})`;

export function launchFlags(
  frontmatter: AgentFrontmatter | null,
  settings: AgentSettings,
): { model: string; tools: string[] | null; disallowedTools: string[] | null; allowRules: string[] } {
  const skills = settings.skills.mode === "list" ? settings.skills.ids.map(skillAllowRule) : [];
  return {
    model: runModel(frontmatter).model,
    tools: frontmatter?.tools ?? null,
    disallowedTools: frontmatter?.disallowedTools ?? null,
    allowRules: [...settings.allow, ...skills],
  };
}

export function exampleTicket(project: ProjectSnapshot): TicketView {
  const key = `${project.meta.key}-0`;
  return {
    id: "example",
    key,
    pendingSeq: null,
    title: "Ticket d'exemple",
    description: "Ticket fictif : il montre le brief que reçoit l'agent sur un ticket de ce projet.",
    statusId: "todo",
    blockedReason: null,
    domainId: null,
    assignee: null,
    parentId: null,
    externalRefs: [],
    labels: [],
    agentProgress: EMPTY_PROGRESS,
    delivery: null,
    progress: { done: 0, total: 0 },
    waitingOn: [],
    keyLabel: key,
    openQuestions: 0,
    startable: true,
  };
}
