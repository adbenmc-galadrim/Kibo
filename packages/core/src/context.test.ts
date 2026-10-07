import { expect, test } from "bun:test";
import { ASK_TOOL, type Guideline, type Ticket } from "@kibo/schema";
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
  g("1", { scope: "domain", domainId: "core" }, "guidelines/core.md"),
  g("2", { scope: "workspace" }, "guidelines/git.md"),
  g("3", { scope: "project", projectId: "p1" }, "guidelines/kibo.md"),
  g("4", { scope: "profile", profileId: "opus" }, "front.md"),
  g("5", { scope: "workspace" }, "guidelines/general.md"),
  g("6", { scope: "domain", domainId: "ui" }, "guidelines/ui.md"),
  g("7", { scope: "project", projectId: "p2" }, "guidelines/other.md"),
];

test("the chain keeps what applies, from workspace to profile", () => {
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core", profileId: "opus" });
  expect(chain.map((x) => x.id)).toEqual(["5", "2", "3", "1", "4"]);
  expect(guidelineChain(all, { projectId: "p1", domainId: null, profileId: null }).map((x) => x.id)).toEqual([
    "5",
    "2",
    "3",
  ]);
});

function kibo() {
  const doc = createProjectDoc({
    id: "p1",
    key: "KIB",
    name: "Kibo",
    folder: null,
    color: "#F97316",
    worktree: null,
  });
  const run = (cmd: Parameters<typeof executeProjectCommand>[1]) => executeProjectCommand(doc, cmd);
  const dep = run({ method: "createTicket", title: "Schéma Loro", statusId: "in_progress" }) as Ticket;
  const t = run({
    method: "createTicket",
    title: "Kanban : drag & drop",
    description: "Garder l'ordre.",
  }) as Ticket;
  run({ method: "createTicket", title: "Poignée", parentId: t.id, statusId: "done" });
  run({ method: "addLink", from: dep.id, to: t.id, type: "blocks" });
  const project = readProject(doc);
  const ticket = project.tickets.find((x) => x.id === t.id);
  if (!ticket) throw new Error("fixture ticket missing");
  return { project, ticket };
}

test("the brief lists the ticket, its sub-tickets, its dependencies and the note", () => {
  const { project, ticket } = kibo();
  const brief = buildBrief({
    project,
    ticket,
    domain: { id: "ui", name: "UI", color: "#EC4899" },
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
      "- KIB-3 · Poignée (Terminé)",
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
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core", profileId: null });
  const prompt = buildSystemPrompt(chain, ["sonnet", "haiku"]);
  expect(prompt.indexOf("## workspace · guidelines/general.md")).toBeLessThan(
    prompt.indexOf("## domaine · guidelines/core.md"),
  );
  expect(prompt).toContain(`\`${ASK_TOOL}\``);
  expect(prompt).toContain("Sous-agents autorisés : Sonnet, Haiku.");
  expect(buildSystemPrompt([], [])).toContain("Sous-agents autorisés : aucun.");
});

test("the run context lists every file to materialize", () => {
  const { project, ticket } = kibo();
  const chain = guidelineChain(all, { projectId: "p1", domainId: "core", profileId: "opus" });
  const ctx = buildRunContext({ project, ticket, domain: null, note: "", chain, subagents: [] });
  expect(ctx.files.map((f) => f.path)).toEqual([
    "context/1-workspace/guidelines/general.md",
    "context/1-workspace/guidelines/git.md",
    "context/2-projet/guidelines/kibo.md",
    "context/3-domaine/guidelines/core.md",
    "context/4-profil/front.md",
    "CLAUDE.md",
    "brief.md",
  ]);
  expect(ctx.tokens).toBe(Math.ceil((ctx.systemPrompt.length + ctx.brief.length) / 4));
  expect(ctx.brief).not.toContain("## Consignes");
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
