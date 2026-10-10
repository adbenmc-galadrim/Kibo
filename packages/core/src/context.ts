import {
  type AgentModel,
  ASK_QUESTION_TOOL,
  ASK_TOOL,
  branchRefOf,
  type Domain,
  estimateTokens,
  type Guideline,
  type GuidelineScope,
  PROGRESS_TOOL,
  type ProjectSnapshot,
  type PrState,
  type Question,
  type QuestionRecipient,
  type Step,
  type TicketView,
} from "@kibo/schema";

export type ChainTarget = { projectId: string; domainId: string | null; profileId: string | null };
export type BriefInput = {
  project: ProjectSnapshot;
  ticket: TicketView;
  domain: Domain | null;
  note: string;
  commits?: readonly string[];
};
export type RunProtocol = { progress: boolean; recipients: readonly QuestionRecipient[] };
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

function workSections(project: ProjectSnapshot, ticket: TicketView, commits: readonly string[]): string[] {
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
    ...section("PR", prs),
  ];
}

function stepLine(step: Step): string {
  const state = step.status === "doing" ? " (en cours)" : step.status === "blocked" ? " (bloquée)" : "";
  return `- [${step.status === "done" ? "x" : " "}] ${step.title}${state}`;
}

export function buildBrief({ project, ticket, domain, note, commits = [] }: BriefInput): string {
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
  lines.push(...workSections(project, ticket, commits));
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

function recipientRules(protocol: RunProtocol | undefined): string[] {
  if (!protocol || protocol.recipients.length === 0) return [];
  return [
    "- Destinataire d'une question (`recipient`, id ou nom), sinon `me` :",
    ...protocol.recipients.map((r) => `  - ${r.id} — ${r.name}`),
  ];
}

export function buildSystemPrompt(
  chain: Guideline[],
  subagents: AgentModel[],
  protocol?: RunProtocol,
): string {
  const allowed = subagents.length > 0 ? subagents.map((m) => MODEL_NAME[m]).join(", ") : "aucun";
  return [
    "# Guidelines Kibo",
    "",
    "Ordre d'injection : workspace → projet → domaine → profil.",
    "",
    ...chain.flatMap((g) => [`## ${SCOPE_LABEL[g.owner.scope]} · ${g.path}`, "", g.content.trim(), ""]),
    "## Protocole Kibo",
    "",
    `- Décision à prendre par l'utilisateur avant de continuer ⇒ \`${ASK_TOOL}\`, puis termine ton tour sans autre action. Kibo te relancera avec sa réponse.`,
    `- Décision que tu peux prendre provisoirement ⇒ \`${ASK_QUESTION_TOOL}\` avec ton choix provisoire, puis continue.`,
    "- Jamais de décision à valider dans ton texte final : Kibo ne le lit pas.",
    ...recipientRules(protocol),
    ...progressRules(protocol),
    `- Sous-agents autorisés : ${allowed}.`,
    "",
  ].join("\n");
}

export function buildRunContext(
  input: BriefInput & { chain: Guideline[]; subagents: AgentModel[]; protocol?: RunProtocol },
): RunContext {
  const brief = buildBrief(input);
  const systemPrompt = buildSystemPrompt(input.chain, input.subagents, input.protocol);
  const files: ContextFile[] = [
    ...input.chain.map((g) => ({ path: `context/${FOLDER[g.owner.scope]}/${g.path}`, content: g.content })),
    { path: "CLAUDE.md", content: systemPrompt },
    { path: "brief.md", content: brief },
  ];
  return { files, systemPrompt, brief, tokens: estimateTokens(systemPrompt + brief) };
}
