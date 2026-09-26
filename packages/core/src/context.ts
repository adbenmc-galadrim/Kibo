import {
  type AgentModel,
  ASK_TOOL,
  type Domain,
  estimateTokens,
  type Guideline,
  type GuidelineScope,
  type ProjectSnapshot,
  type TicketView,
} from "@kibo/schema";

export type ChainTarget = { projectId: string; domainId: string | null; profileId: string | null };
export type BriefInput = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domain: Domain | null;
  note: string;
};
export type ContextFile = { path: string; content: string };
export type RunContext = { files: ContextFile[]; systemPrompt: string; brief: string; tokens: number };

const ORDER: GuidelineScope[] = ["workspace", "project", "domain", "profile"];
const FOLDER: Record<GuidelineScope, string> = {
  workspace: "1-workspace",
  project: "2-projet",
  domain: "3-domaine",
  profile: "4-profil",
};
const SCOPE_LABEL: Record<GuidelineScope, string> = {
  workspace: "workspace",
  project: "projet",
  domain: "domaine",
  profile: "profil",
};
const MODEL_NAME: Record<AgentModel, string> = { opus: "Opus", sonnet: "Sonnet", haiku: "Haiku" };

function applies(g: Guideline, target: ChainTarget): boolean {
  switch (g.owner.scope) {
    case "workspace":
      return true;
    case "project":
      return g.owner.projectId === target.projectId;
    case "domain":
      return g.owner.domainId === target.domainId;
    case "profile":
      return g.owner.profileId === target.profileId;
  }
}

export function guidelineChain(all: Guideline[], target: ChainTarget): Guideline[] {
  return all
    .filter((g) => applies(g, target))
    .sort(
      (a, b) => ORDER.indexOf(a.owner.scope) - ORDER.indexOf(b.owner.scope) || a.path.localeCompare(b.path),
    );
}

export function buildBrief({ project, ticket, domain, note }: BriefInput): string {
  const label = (id: string) => project.workflow.find((s) => s.id === id)?.label ?? id;
  const children = project.tickets.filter((t) => t.parentId === ticket.id);
  const blockers = project.links
    .filter((l) => l.type === "blocks" && l.to === ticket.id)
    .map((l) => project.tickets.find((t) => t.id === l.from))
    .filter((t): t is TicketView => t !== undefined);
  const lines = [
    `# ${ticket.keyLabel} · ${ticket.title}`,
    "",
    `- Projet : ${project.meta.name}`,
    `- Domaine : ${domain?.name ?? "aucun"}`,
    `- Statut : ${label(ticket.statusId)}`,
    "",
    "## Description",
    "",
    ticket.description.trim() || "Aucune description.",
  ];
  if (children.length > 0) {
    lines.push(
      "",
      "## Sous-tickets",
      "",
      ...children.map((c) => `- ${c.keyLabel} · ${c.title} (${label(c.statusId)})`),
    );
  }
  if (blockers.length > 0) {
    lines.push(
      "",
      "## Dépendances",
      "",
      ...blockers.map((b) => `- Attend ${b.keyLabel} · ${b.title} (${label(b.statusId)})`),
    );
  }
  const mockups = ticket.externalRefs.filter((r) => r.kind === "figma_node");
  if (mockups.length > 0) {
    lines.push("", "## Maquettes", "", ...mockups.map((m) => `- ${m.name} : ${m.url}`));
  }
  if (note.trim()) lines.push("", "## Consignes", "", note.trim());
  return `${lines.join("\n")}\n`;
}

export function buildSystemPrompt(chain: Guideline[], subagents: AgentModel[]): string {
  const allowed = subagents.length > 0 ? subagents.map((m) => MODEL_NAME[m]).join(", ") : "aucun";
  return [
    "# Guidelines Kibo",
    "",
    "Ordre d'injection : workspace → projet → domaine → profil.",
    "",
    ...chain.flatMap((g) => [`## ${SCOPE_LABEL[g.owner.scope]} · ${g.path}`, "", g.content.trim(), ""]),
    "## Protocole Kibo",
    "",
    `- Pour poser une question à l'utilisateur, appelle l'outil \`${ASK_TOOL}\` avec ta question, puis termine ton tour sans autre action. Kibo te relancera avec sa réponse.`,
    `- Sous-agents autorisés : ${allowed}.`,
    "",
  ].join("\n");
}

export function buildRunContext(
  input: BriefInput & { chain: Guideline[]; subagents: AgentModel[] },
): RunContext {
  const brief = buildBrief(input);
  const systemPrompt = buildSystemPrompt(input.chain, input.subagents);
  const files: ContextFile[] = [
    ...input.chain.map((g) => ({ path: `context/${FOLDER[g.owner.scope]}/${g.path}`, content: g.content })),
    { path: "CLAUDE.md", content: systemPrompt },
    { path: "brief.md", content: brief },
  ];
  return { files, systemPrompt, brief, tokens: estimateTokens(systemPrompt + brief) };
}
