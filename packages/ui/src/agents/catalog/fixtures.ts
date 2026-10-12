import {
  type Agent,
  type AgentSettings,
  type AgentSummary,
  DEFAULT_AGENT_SETTINGS,
  type SystemAgentId,
  systemAgentSettings,
} from "@kibo/schema";

type SummaryInput = Partial<Omit<AgentSummary, "settings">> & {
  name: string;
  settings?: Partial<AgentSettings>;
};

export function summaryFixture({ name, settings = {}, ...over }: SummaryInput): AgentSummary {
  const scope = over.scope ?? "global";
  const projectId = over.projectId ?? null;
  return {
    ref: scope === "project" ? `project:${projectId}:${name}` : `global:${name}`,
    scope,
    projectId,
    name,
    path:
      scope === "project"
        ? `/Users/adam/goinfre/Kibo/.claude/agents/${name}.md`
        : `~/.claude/agents/${name}.md`,
    hash: `hash-${name}`,
    problem: null,
    nameWarning: null,
    settings: { ...DEFAULT_AGENT_SETTINGS, ...settings },
    shadowedBy: null,
    activeRuns: 0,
    modifiedAt: null,
    description: `${name} : une phrase qui dit quand l'appeler.`,
    model: null,
    skillsCount: null,
    subagentsCount: 0,
    ...over,
  };
}

export function systemSummaryFixture(id: SystemAgentId): AgentSummary {
  return summaryFixture({
    name: `kibo-${id}`,
    ref: `system:${id}`,
    scope: "system",
    settings: systemAgentSettings(id, {}),
    description: `Agent ${id} de Kibo.`,
    model: "sonnet",
    skillsCount: 0,
  });
}

export const DELIVERY_DESCRIPTION =
  "Livre un ticket : lit le ticket, planifie, code en TDD, commite et ouvre la PR.";

export function catalogFixture(): AgentSummary[] {
  return [
    summaryFixture({
      name: "opus-dev",
      model: "opus",
      skillsCount: 3,
      activeRuns: 2,
      description: DELIVERY_DESCRIPTION,
    }),
    summaryFixture({
      name: "review-pr",
      model: "sonnet",
      skillsCount: 2,
      subagentsCount: 1,
      shadowedBy: "project:kibo:review-pr",
      description: "Relit une PR en lecture seule et rend un verdict accepté ou refusé.",
    }),
    summaryFixture({
      name: "review-pr",
      scope: "project",
      projectId: "kibo",
      model: "sonnet",
      description: "Relit une PR de Kibo selon CLAUDE.md : Biome, TDD, commits en français.",
    }),
    summaryFixture({
      name: "sonnet-dev",
      model: "fable",
      nameWarning: "Nom peu parlant : dis ce que fait l'agent (review-pr, livraison-front)",
      description: "Agent migré du profil Kibo sonnet-dev.",
    }),
    summaryFixture({
      name: "ux-audit",
      problem: "frontmatter illisible : description",
      description: "",
    }),
    systemSummaryFixture("assistant"),
    systemSummaryFixture("generateur"),
    systemSummaryFixture("demo"),
    systemSummaryFixture("project-agent"),
  ];
}

export const SPEC_BODY =
  "# Livraison\nTu livres un ticket Kibo de bout en bout.\n\n## Règles\n- Jamais de --no-verify.\n";

export function agentFixture(over: Partial<Agent> = {}): Agent {
  return {
    ref: "global:livraison",
    scope: "global",
    projectId: null,
    name: "livraison",
    path: "~/.claude/agents/livraison.md",
    problem: null,
    nameWarning: null,
    shadowedBy: null,
    activeRuns: 1,
    modifiedAt: null,
    hash: "h1",
    settings: { ...DEFAULT_AGENT_SETTINGS, maxParallel: 2, allow: ["Bash(bun test *)"] },
    file: {
      frontmatter: {
        name: "livraison",
        description: DELIVERY_DESCRIPTION,
        model: "opus",
        skills: ["porte-qualite"],
        extra: "color: orange\nmaxTurns: 80\n",
        extraKeys: ["color", "maxTurns"],
      },
      body: SPEC_BODY,
    },
    ...over,
  };
}
