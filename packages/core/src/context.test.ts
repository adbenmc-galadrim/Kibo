import { expect, test } from "bun:test";
import { ASK_QUESTION_TOOL, ASK_TOOL, type Guideline, type Question, type Ticket } from "@kibo/schema";
import { NO_AGENT } from "./agents/compose";
import { executeProjectCommand, readProject } from "./commands";
import { buildBrief, buildRunContext, buildSystemPrompt, guidelineChain } from "./context";
import { createProjectDoc } from "./project";

const g = (id: string, owner: Guideline["owner"], path: string, content = `# ${path}`): Guideline => ({
  id,
  owner,
  path,
  content,
});
const all: Guideline[] = [
  g("1", { scope: "domain", domainId: "core", projectId: null }, "guidelines/core.md"),
  g("2", { scope: "workspace" }, "guidelines/git.md"),
  g("3", { scope: "project", projectId: "p1" }, "guidelines/kibo.md"),
  g("5", { scope: "workspace" }, "guidelines/general.md"),
  g("6", { scope: "domain", domainId: "ui", projectId: null }, "guidelines/ui.md"),
  g("7", { scope: "project", projectId: "p2" }, "guidelines/other.md"),
];

test("the chain keeps what applies, from workspace to domain", () => {
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core" });
  expect(chain.map((x) => x.id)).toEqual(["5", "2", "3", "1"]);
  expect(guidelineChain(all, { projectId: "p1", domainId: null }).map((x) => x.id)).toEqual(["5", "2", "3"]);
});

function kibo() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
  });
  const run = (cmd: Parameters<typeof executeProjectCommand>[1]) => executeProjectCommand(doc, cmd);
  const dep = run({ method: "createTicket", title: "Schéma Loro", statusId: "in_progress" }) as Ticket;
  const t = run({
    method: "createTicket",
    title: "Kanban : drag & drop",
    description: "Garder l'ordre.",
  }) as Ticket;
  run({ method: "createTicket", title: "Poignée", parentId: t.id, statusId: "backlog" });
  run({ method: "addLink", from: dep.id, to: t.id, type: "blocks" });
  const project = readProject(doc, "2026-10-16");
  const ticket = project.tickets.find((x) => x.id === t.id);
  if (!ticket) throw new Error("fixture ticket missing");
  return { project, ticket };
}

test("the brief lists the ticket, its sub-tickets, its dependencies and the note", () => {
  const { project, ticket } = kibo();
  const brief = buildBrief({
    project,
    ticket,
    domain: { id: "ui", name: "UI", color: "#EC4899", owner: { scope: "workspace" } },
    note: "Utilise dnd-kit.",
  });
  expect(brief).toBe(
    [
      "# KIB-2 · Kanban : drag & drop",
      "",
      "- Projet : Kibo",
      "- Domaine : UI",
      "- Statut : À faire",
      "",
      "## Description",
      "",
      "Garder l'ordre.",
      "",
      "## Sous-tickets",
      "",
      "- KIB-3 · Poignée (Backlog)",
      "",
      "## Dépendances",
      "",
      "- Attend KIB-1 · Schéma Loro (En cours)",
      "",
      "## Consignes",
      "",
      "Utilise dnd-kit.",
      "",
    ].join("\n"),
  );
});

test("the system prompt concatenates the chain and ends with the Kibo protocol", () => {
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core" });
  const prompt = buildSystemPrompt(chain, NO_AGENT);
  expect(prompt.indexOf("## workspace · guidelines/general.md")).toBeLessThan(
    prompt.indexOf("## domaine · guidelines/core.md"),
  );
  expect(prompt).toContain(`\`${ASK_TOOL}\``);
  expect(prompt).toContain(`\`${ASK_QUESTION_TOOL}\``);
  expect(prompt).toContain("Jamais de décision à valider dans ton texte final");
  expect(prompt).toContain("Ordre d'injection : workspace → projet → domaine du ticket → spec de l'agent.");
  expect(prompt).not.toContain("## agent ·");
});

const REVIEW_AGENT = {
  ...NO_AGENT,
  name: "review-pr",
  body: "Tu relis.",
  subagents: [{ name: "livraison", description: "Livre" }],
  skills: { mode: "list" as const, entries: [{ id: "a", description: "A" }] },
};

test("the agent spec comes after the guidelines, with its subagents and skills", () => {
  const prompt = buildSystemPrompt([], REVIEW_AGENT, {
    progress: true,
    recipients: [],
    signals: true,
    skillReview: true,
    parallel: false,
  });
  for (const fragment of [
    "## agent · review-pr",
    "Tu relis.",
    "Sous-agents appelables : `livraison` — Livre (aucun autre)",
    "Skills autorisés : `a` — A",
    "skill_review",
  ]) {
    expect(prompt).toContain(fragment);
  }
  expect(prompt.indexOf("## agent · review-pr")).toBeLessThan(prompt.indexOf("## Protocole Kibo"));
  expect(buildSystemPrompt([], NO_AGENT)).toContain("Skills : tous ceux de la machine et du projet");
});

test("the neutral agent keeps the former prompt but for the agent lines", () => {
  expect(buildSystemPrompt([], NO_AGENT)).toBe(
    [
      "# Guidelines Kibo",
      "",
      "Ordre d'injection : workspace → projet → domaine du ticket → spec de l'agent.",
      "",
      "## Protocole Kibo",
      "",
      `- Décision à prendre par l'utilisateur avant de continuer ⇒ \`${ASK_TOOL}\`, puis termine ton tour sans autre action. Kibo te relancera avec sa réponse.`,
      `- Décision que tu peux prendre provisoirement ⇒ \`${ASK_QUESTION_TOOL}\` avec ton choix provisoire, puis continue.`,
      "- Jamais de décision à valider dans ton texte final : Kibo ne le lit pas.",
      "- Sous-agents appelables : aucun.",
      "- Skills : tous ceux de la machine et du projet.",
      "",
    ].join("\n"),
  );
});

test("the run context lists every file to materialize", () => {
  const { project, ticket } = kibo();
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core" });
  const ctx = buildRunContext({ project, ticket, domain: null, note: "", chain, agent: REVIEW_AGENT });
  expect(ctx.files.map((f) => f.path)).toEqual([
    "context/1-workspace/guidelines/general.md",
    "context/1-workspace/guidelines/git.md",
    "context/2-projet/guidelines/kibo.md",
    "context/3-domaine/guidelines/core.md",
    "context/4-agent/review-pr.md",
    "CLAUDE.md",
    "brief.md",
  ]);
  expect(ctx.tokens).toBe(Math.ceil((ctx.systemPrompt.length + ctx.brief.length) / 4));
  expect(ctx.brief).not.toContain("## Consignes");
  expect(ctx.files.find((f) => f.path === "context/4-agent/review-pr.md")?.content).toBe("Tu relis.");
  const bare = buildRunContext({ project, ticket, domain: null, note: "", chain, agent: NO_AGENT });
  expect(bare.files.some((f) => f.path.startsWith("context/4-agent/"))).toBe(false);
});

test("the brief lists the linked mockups, only their URL", () => {
  const { project, ticket } = kibo();
  const figma = {
    kind: "figma_node" as const,
    fileKey: "AbC123xyz",
    nodeId: "12:34",
    url: "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34",
    name: "Arbre",
  };
  const withMockup = buildBrief({
    project,
    ticket: { ...ticket, externalRefs: [figma] },
    domain: null,
    note: "",
  });
  expect(withMockup).toContain(
    "## Maquettes\n\n- Arbre : https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34\n",
  );
  expect(buildBrief({ project, ticket, domain: null, note: "" })).not.toContain("## Maquettes");
});

test("the brief lists penpot boards next to figma nodes", () => {
  const { project, ticket } = kibo();
  const url =
    "http://localhost:9010/#/workspace/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333?page-id=44444444-4444-4444-8444-444444444444&board-id=55555555-5555-4555-8555-555555555555";
  const board = {
    kind: "penpot_board" as const,
    instance: "http://localhost:9010",
    fileId: "33333333-3333-4333-8333-333333333333",
    pageId: "44444444-4444-4444-8444-444444444444",
    boardId: "55555555-5555-4555-8555-555555555555",
    url,
    name: "Fiche",
  };
  const brief = buildBrief({ project, ticket: { ...ticket, externalRefs: [board] }, domain: null, note: "" });
  expect(brief).toContain(`## Maquettes\n\n- Fiche : ${url}\n`);
});

test("the brief names the branch and the labels only when the ticket has them", () => {
  const { project, ticket } = kibo();
  const brief = buildBrief({
    project,
    ticket: {
      ...ticket,
      labels: ["area:api", "phase:p1"],
      externalRefs: [{ kind: "git_branch", branch: "feat/x", base: "feat/parent" }],
    },
    domain: null,
    note: "",
  });
  expect(brief).toContain(
    "- Statut : À faire\n- Branche : feat/x (base feat/parent)\n- Étiquettes : area:api, phase:p1\n",
  );
  const unstacked = buildBrief({
    project,
    ticket: { ...ticket, externalRefs: [{ kind: "git_branch", branch: "feat/x", base: null }] },
    domain: null,
    note: "",
  });
  expect(unstacked).toContain("- Branche : feat/x\n");
  const bare = buildBrief({ project, ticket, domain: null, note: "" });
  expect(bare).not.toContain("- Branche");
  expect(bare).not.toContain("- Étiquettes");
});

const question = (ticketId: string, over: Partial<Question>): Question => ({
  kind: "question",
  images: [],
  id: "q1",
  ticketId,
  runId: "r1",
  title: "Bloquer le dépôt ?",
  context: "",
  options: ["Oui", "Non"],
  provisional: "Non",
  blocking: false,
  createdBy: { kind: "agent", ref: "emis-livraison" },
  createdAt: 1,
  importRef: null,
  answer: null,
  recipient: "me",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
  ...over,
});

test("the brief lists the questions of the ticket, the branch commits and the PR", () => {
  const { project, ticket } = kibo();
  const answered = question(ticket.id, {
    id: "q2",
    title: "Un admin non affecté accède-t-il aux fichiers ?",
    createdAt: 2,
    answer: {
      kind: "confirm",
      option: "Non",
      text: "",
      by: { kind: "human", ref: "adam" },
      at: 3,
      deliveredAt: null,
      deliveredRunId: null,
    },
  });
  const bare = question(ticket.id, {
    id: "q3",
    title: "Quel port ?",
    options: [],
    provisional: null,
    createdAt: 3,
  });
  const elsewhere = question("other", { id: "q4", title: "Ailleurs" });
  const brief = buildBrief({
    project: { ...project, questions: [question(ticket.id, {}), answered, bare, elsewhere] },
    ticket: {
      ...ticket,
      externalRefs: [
        {
          kind: "github_pr",
          url: "https://github.com/o/r/pull/7",
          number: 7,
          state: "open",
          base: "dev",
          head: "feat/x",
          review: "none",
          checks: null,
        },
        {
          kind: "github_pr",
          url: "https://github.com/o/r/pull/3",
          number: 3,
          state: "merged",
          base: null,
          head: null,
          review: "none",
          checks: null,
        },
      ],
    },
    domain: null,
    note: "Utilise dnd-kit.",
    commits: ["abc1234 feat: drag", "def5678 fix: drop"],
  });
  expect(brief).toContain(
    [
      "## Questions",
      "",
      "- [ouverte] Bloquer le dépôt ? (options : Oui, Non ; provisoire : Non)",
      "- [répondue] Un admin non affecté accède-t-il aux fichiers ? ⇒ Non (adam)",
      "- [ouverte] Quel port ?",
      "",
      "## Commits de la branche",
      "",
      "- abc1234 feat: drag",
      "- def5678 fix: drop",
      "",
      "## PR",
      "",
      "- https://github.com/o/r/pull/7 (ouverte, base dev)",
      "- https://github.com/o/r/pull/3 (fusionnée)",
      "",
      "## Consignes",
    ].join("\n"),
  );
  expect(brief).not.toContain("Ailleurs");
});

test("a text answer is quoted as is, and nothing is added without question, commit or PR", () => {
  const { project, ticket } = kibo();
  const text = question(ticket.id, {
    answer: {
      kind: "text",
      option: null,
      text: "Seulement les admins",
      by: { kind: "human", ref: "adam" },
      at: 3,
      deliveredAt: null,
      deliveredRunId: null,
    },
  });
  const brief = buildBrief({
    project: { ...project, questions: [text] },
    ticket,
    domain: null,
    note: "",
    commits: [],
  });
  expect(brief).toContain("- [répondue] Bloquer le dépôt ? ⇒ Seulement les admins (adam)\n");
  const bare = buildBrief({ project, ticket, domain: null, note: "" });
  expect(bare).not.toContain("## Questions");
  expect(bare).not.toContain("## Commits de la branche");
  expect(bare).not.toContain("## PR");
});

test("the work in progress of the other runs comes right after the branch commits", () => {
  const { project, ticket } = kibo();
  const work = "## Travail en cours sur le projet\n\n### bou · livraison · BOU-12 · Dates";
  const brief = buildBrief({
    project,
    ticket,
    domain: null,
    note: "Utilise dnd-kit.",
    commits: ["abc1234 feat: drag"],
    work,
  });
  expect(brief).toContain(
    ["## Commits de la branche", "", "- abc1234 feat: drag", "", work, "", "## Consignes"].join("\n"),
  );
  const alone = buildBrief({ project, ticket, domain: null, note: "", work });
  expect(alone.endsWith(`${work}\n`)).toBe(true);
  expect(buildBrief({ project, ticket, domain: null, note: "", work: null })).not.toContain(
    "Travail en cours",
  );
});

test("the brief leaves the archived questions out", () => {
  const { project, ticket } = kibo();
  const archived = question(ticket.id, {
    id: "q9",
    title: "Question archivée ?",
    archivedAt: 5,
    archivedBy: { kind: "human", ref: "adam" },
  });
  const brief = buildBrief({
    project: { ...project, questions: [question(ticket.id, {}), archived] },
    ticket,
    domain: null,
    note: "",
  });
  expect(brief).toContain("- [ouverte] Bloquer le dépôt ?");
  expect(brief).not.toContain("Question archivée");
  const alone = buildBrief({
    project: { ...project, questions: [archived] },
    ticket,
    domain: null,
    note: "",
  });
  expect(alone).not.toContain("## Questions");
});
