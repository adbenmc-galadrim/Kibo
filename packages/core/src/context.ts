import {
  ASK_QUESTION_TOOL,
  ASK_TOOL,
  branchRefOf,
  type Domain,
  estimateTokens,
  type Guideline,
  type GuidelineScope,
  PARALLEL_RULES,
  PARALLEL_RULES_TITLE,
  PROGRESS_TOOL,
  type ProjectSnapshot,
  type PrState,
  type Question,
  type QuestionRecipient,
  SIGNAL_TOOL,
  SKILL_REVIEW_TOOL,
  type Step,
  type TicketView,
} from "@kibo/schema";
import type { AgentContext } from "./agents/compose";

export type ChainTarget = { projectId: string; domainId: string | null };
export type BriefInput = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domain: Domain | null;
  note: string;
  commits?: readonly string[];
  work?: string | null;
};
export type RunProtocol = {
  progress: boolean;
  recipients: readonly QuestionRecipient[];
  signals: boolean;
  skillReview: boolean;
  parallel: boolean;
};
export type ContextFile = { path: string; content: string };
export type RunContext = { files: ContextFile[]; systemPrompt: string; brief: string; tokens: number };

const ORDER: GuidelineScope[] = ["workspace", "project", "domain"];
export const FOLDER: Record<GuidelineScope | "agent", string> = {
  workspace: "1-workspace",
  project: "2-projet",
  domain: "3-domaine",
  agent: "4-agent",
};
const SCOPE_LABEL: Record<GuidelineScope, string> = {
  workspace: "workspace",
  project: "projet",
  domain: "domaine",
};

function applies(g: Guideline, target: ChainTarget): boolean {
  switch (g.owner.scope) {
    case "workspace":
      return true;
    case "project":
      return g.owner.projectId === target.projectId;
    case "domain":
      return g.owner.domainId === target.domainId;
  }
}

export function guidelineChain(all: Guideline[], target: ChainTarget): Guideline[] {
  return all
    .filter((g) => applies(g, target))
    .sort(
      (a, b) => ORDER.indexOf(a.owner.scope) - ORDER.indexOf(b.owner.scope) || a.path.localeCompare(b.path),
    );
}

function ticketFacts(ticket: TicketView): string[] {
  const facts: string[] = [];
  const branch = branchRefOf(ticket.externalRefs);
  if (branch) facts.push(`- Branche : ${branch.branch}${branch.base ? ` (base ${branch.base})` : ""}`);
  if (ticket.labels.length > 0) facts.push(`- Étiquettes : ${ticket.labels.join(", ")}`);
  return facts;
}

const PR_STATE: Record<PrState, string> = {
  open: "ouverte",
  draft: "brouillon",
  merged: "fusionnée",
  closed: "fermée",
};

function questionLine(q: Question): string {
  if (q.answer !== null) {
    const value = q.answer.kind === "text" ? q.answer.text : (q.answer.option ?? "");
    return `- [répondue] ${q.title} ⇒ ${value} (${q.answer.by.ref})`;
  }
  const facts = [
    ...(q.options.length > 0 ? [`options : ${q.options.join(", ")}`] : []),
    ...(q.provisional !== null ? [`provisoire : ${q.provisional}`] : []),
  ];
  return `- [ouverte] ${q.title}${facts.length > 0 ? ` (${facts.join(" ; ")})` : ""}`;
}

function section(title: string, items: readonly string[]): string[] {
  return items.length > 0 ? ["", `## ${title}`, "", ...items] : [];
}

function workSections(
  project: ProjectSnapshot,
  ticket: TicketView,
  commits: readonly string[],
  work: string | null,
): string[] {
  const questions = project.questions.filter((q) => q.ticketId === ticket.id).map(questionLine);
  const prs = ticket.externalRefs.flatMap((r) =>
    r.kind === "github_pr"
      ? [`- ${r.url} (${[PR_STATE[r.state], ...(r.base ? [`base ${r.base}`] : [])].join(", ")})`]
      : [],
  );
  return [
    ...section("Questions", questions),
    ...section(
      "Commits de la branche",
      commits.map((c) => `- ${c}`),
    ),
    ...(work?.trim() ? ["", work.trim()] : []),
    ...section("PR", prs),
  ];
}

function stepLine(step: Step): string {
  const state = step.status === "doing" ? " (en cours)" : step.status === "blocked" ? " (bloquée)" : "";
  return `- [${step.status === "done" ? "x" : " "}] ${step.title}${state}`;
}

export function buildBrief({ project, ticket, domain, note, commits = [], work = null }: BriefInput): string {
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
    ...ticketFacts(ticket),
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
  const mockups = ticket.externalRefs.filter((r) => r.kind === "figma_node" || r.kind === "penpot_board");
  if (mockups.length > 0) {
    lines.push("", "## Maquettes", "", ...mockups.map((m) => `- ${m.name} : ${m.url}`));
  }
  lines.push(...section("Plan en cours", ticket.agentProgress.plan.map(stepLine)));
  lines.push(...workSections(project, ticket, commits, work));
  if (note.trim()) lines.push("", "## Consignes", "", note.trim());
  return `${lines.join("\n")}\n`;
}

function progressRules(protocol: RunProtocol | undefined): string[] {
  if (!protocol?.progress) return [];
  return [
    `- Avant de modifier un fichier, déclare ton plan avec \`${PROGRESS_TOOL}\` (\`plan\` : toutes les étapes, une seule \`doing\`), puis tiens-le à jour à chaque étape.`,
    `- Avant de terminer, remplis ton compte rendu avec \`${PROGRESS_TOOL}\` (\`report\` : done, decisions, toCheck, files, next).`,
    "- Tes phrases s'affichent dans le fil du ticket : écris-les pour un lecteur humain, courtes et claires.",
  ];
}

function signalRules(protocol: RunProtocol | undefined): string[] {
  if (!protocol?.signals) return [];
  return [
    `- Tu ne crées jamais de ticket : un ticket à créer, un blocage, un contexte utile au projet ou une question pour le chef de projet passent par \`${SIGNAL_TOOL}\` (kind, titre court, corps facultatif, ticket visé). Un signal n'agit pas : l'agent de projet propose, l'utilisateur valide. Vingt signaux au plus par run ; regroupe.`,
    `- Une question bloquante pour continuer reste \`${ASK_TOOL}\`.`,
  ];
}

function recipientRules(protocol: RunProtocol | undefined): string[] {
  if (!protocol || protocol.recipients.length === 0) return [];
  return [
    "- Destinataire d'une question (`recipient`, id ou nom), sinon `me` :",
    ...protocol.recipients.map((r) => `  - ${r.id} — ${r.name}`),
  ];
}

function skillReviewRules(protocol: RunProtocol | undefined): string[] {
  if (!protocol?.skillReview) return [];
  return [
    `- Avant de terminer, si tu as utilisé un skill, laisse une review avec \`${SKILL_REVIEW_TOOL}\` : par skill, \`ok\` ou \`improve\`, une note de trois lignes au plus (ce qui a aidé, ce qui a manqué, ce que tu changerais), et, si tu proposes une modification, le contenu complet corrigé de \`SKILL.md\` dans \`suggestion\`. Rien n'est modifié sans validation de l'utilisateur.`,
  ];
}

const parallelRules = (protocol: RunProtocol | undefined): string[] =>
  protocol?.parallel ? ["", PARALLEL_RULES_TITLE, "", ...PARALLEL_RULES.map((r) => `- ${r}`)] : [];

const described = (items: readonly { id: string; description: string }[]): string =>
  items.map((i) => (i.description ? `\`${i.id}\` — ${i.description}` : `\`${i.id}\``)).join(", ");

function agentRules(agent: AgentContext): string[] {
  const subagents = described(agent.subagents.map((s) => ({ id: s.name, description: s.description })));
  return [
    agent.subagents.length > 0
      ? `- Sous-agents appelables : ${subagents} (aucun autre).`
      : "- Sous-agents appelables : aucun.",
    agent.skills.mode === "all"
      ? "- Skills : tous ceux de la machine et du projet."
      : `- Skills autorisés : ${agent.skills.entries.length > 0 ? described(agent.skills.entries) : "aucun"}.`,
  ];
}

const agentSection = (agent: AgentContext): string[] =>
  agent.body.trim() ? [`## agent · ${agent.name}`, "", agent.body.trim(), ""] : [];

export function buildSystemPrompt(chain: Guideline[], agent: AgentContext, protocol?: RunProtocol): string {
  return [
    "# Guidelines Kibo",
    "",
    "Ordre d'injection : workspace → projet → domaine du ticket → spec de l'agent.",
    "",
    ...chain.flatMap((g) => [`## ${SCOPE_LABEL[g.owner.scope]} · ${g.path}`, "", g.content.trim(), ""]),
    ...agentSection(agent),
    "## Protocole Kibo",
    "",
    `- Décision à prendre par l'utilisateur avant de continuer ⇒ \`${ASK_TOOL}\`, puis termine ton tour sans autre action. Kibo te relancera avec sa réponse.`,
    `- Décision que tu peux prendre provisoirement ⇒ \`${ASK_QUESTION_TOOL}\` avec ton choix provisoire, puis continue.`,
    "- Jamais de décision à valider dans ton texte final : Kibo ne le lit pas.",
    ...recipientRules(protocol),
    ...progressRules(protocol),
    ...signalRules(protocol),
    ...skillReviewRules(protocol),
    ...agentRules(agent),
    ...parallelRules(protocol),
    "",
  ].join("\n");
}

export function buildRunContext(
  input: BriefInput & { chain: Guideline[]; agent: AgentContext; protocol?: RunProtocol },
): RunContext {
  const brief = buildBrief(input);
  const systemPrompt = buildSystemPrompt(input.chain, input.agent, input.protocol);
  const agentFile = input.agent.body.trim()
    ? [{ path: `context/${FOLDER.agent}/${input.agent.name}.md`, content: input.agent.body }]
    : [];
  const files: ContextFile[] = [
    ...input.chain.map((g) => ({ path: `context/${FOLDER[g.owner.scope]}/${g.path}`, content: g.content })),
    ...agentFile,
    { path: "CLAUDE.md", content: systemPrompt },
    { path: "brief.md", content: brief },
  ];
  return { files, systemPrompt, brief, tokens: estimateTokens(systemPrompt + brief) };
}
