import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentPreview, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { kiboProject } from "../fixtures";

const PREVIEW: AgentPreview = {
  levels: [
    { label: "Workspace", path: "context/1-workspace/core.md", tokens: 420 },
    { label: "Projet · Kibo", path: "context/2-projet/kibo.md", tokens: 1_380 },
    { label: "Agent · chef-orchestre", path: "context/4-agent/chef-orchestre.md", tokens: 610 },
  ],
  systemPrompt: "# Guidelines Kibo\nSous-agents appelables : livraison (aucun autre)\n",
  brief: "# KIB-16 · Moteur de règles déclaratif\n",
  agentsJson: '{\n  "livraison": { "description": "Livre un ticket" }\n}\n',
  command: {
    model: "opus",
    permissionMode: "default",
    tools: null,
    disallowedTools: null,
    allow: ["mcp__kibo__*", "Skill(porte-qualite)"],
    allowOrigins: [],
    addDirs: [],
    subagents: ["livraison", "review"],
    allSubagents: false,
    skills: { mode: "list", ids: ["porte-qualite"] },
  },
};
const calls: RpcRequest[] = [];
let preview: AgentPreview = PREVIEW;

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProject") return Promise.resolve(kiboProject());
        if (req.method === "agents.preview") return Promise.resolve(preview);
        return Promise.resolve(null);
      },
    },
  }),
);

const { PreviewPane } = await import("./PreviewPane");

beforeEach(() => {
  calls.length = 0;
  preview = PREVIEW;
});

test("screen 193d: levels with their tokens, brief, agents.json and the command", async () => {
  render(
    <PreviewPane
      open
      onClose={() => {}}
      agentRef="global:chef-orchestre"
      name="chef-orchestre"
      projectId="kibo"
    />,
  );
  const pane = within(await screen.findByRole("dialog", { name: "Ce que reçoit l'agent" }));
  expect(await pane.findByText("CLAUDE.md composé · 2 410 tokens estimés")).toBeTruthy();
  expect(pane.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
    "Workspace420context/1-workspace/core.md",
    "Projet · Kibo1 380context/2-projet/kibo.md",
    "Agent · chef-orchestre610context/4-agent/chef-orchestre.md",
  ]);
  expect(pane.getByRole("button", { name: "brief.md" })).toBeTruthy();
  expect(pane.getByRole("button", { name: "agents.json" })).toBeTruthy();
  const command = within(pane.getByRole("region", { name: "Commande" }));
  expect(command.getAllByRole("definition").map((d) => d.textContent)).toEqual([
    "opus",
    "Demande à chaque action",
    "tous (pas de champ tools)",
    "mcp__kibo__*, Skill(porte-qualite)",
    "aucune",
    "aucun",
    "livraison, review",
    "porte-qualite",
  ]);
  expect(calls).toContainEqual({ method: "agents.preview", ref: "global:chef-orchestre", projectId: "kibo" });
  expect(pane.getByText("Aucun secret : ni le jeton du run ni les variables d'environnement.")).toBeTruthy();
});

test("the command says every subagent when the agent allows them all", async () => {
  preview = { ...PREVIEW, command: { ...PREVIEW.command, allSubagents: true } };
  render(
    <PreviewPane open onClose={() => {}} agentRef="global:livraison" name="livraison" projectId="kibo" />,
  );
  const pane = within(await screen.findByRole("dialog"));
  const command = within(await pane.findByRole("region", { name: "Commande" }));
  expect(command.getAllByRole("definition")[6]?.textContent).toBe("tous les sous-agents");
});

test("screen 210: rules and folders come with their origin, agent or project", async () => {
  preview = {
    ...PREVIEW,
    command: {
      ...PREVIEW.command,
      allowOrigins: [
        { rule: "Bash(pnpm *)", origin: "project" },
        { rule: "Bash(git *)", origin: "agent" },
      ],
      addDirs: [
        { dir: "/Users/adam/.claude/skills", origin: "agent" },
        { dir: "/Users/adam/Documents/emis", origin: "project" },
      ],
    },
  };
  render(
    <PreviewPane
      open
      onClose={() => {}}
      agentRef="global:full-delivery"
      name="full-delivery"
      projectId="kibo"
    />,
  );
  const command = within(await screen.findByRole("region", { name: "Commande" }));
  const rows = Object.fromEntries(
    command.getAllByRole("term").map((term) => [term.textContent, term.nextElementSibling?.textContent]),
  );
  expect(rows.Règles).toBe("Bash(pnpm *) (projet), Bash(git *) (agent)");
  expect(rows.Dossiers).toBe("~/.claude/skills (agent), ~/Documents/emis (projet)");
});

test("choosing a ticket composes the preview on that ticket", async () => {
  render(
    <PreviewPane
      open
      onClose={() => {}}
      agentRef="global:chef-orchestre"
      name="chef-orchestre"
      projectId="kibo"
    />,
  );
  const pane = within(await screen.findByRole("dialog"));
  const user = userEvent.setup();
  (await pane.findByRole("combobox", { name: "Ticket d'exemple" })).focus();
  await user.keyboard("{Enter}");
  await user.click(await screen.findByRole("option", { name: /KIB-14/ }));
  await waitFor(() =>
    expect(calls.at(-1)).toMatchObject({
      method: "agents.preview",
      projectId: "kibo",
      ticketId: expect.any(String),
    }),
  );
});

const WORK = [
  "## Travail en cours sur le projet",
  "### bou · livraison · BOU-12 — Format des dates de livraison",
  "exports nouveaux : formatDate (src/lib/format-date.ts)",
  "",
  "mcp__kibo__peek_work lit le travail d'un autre run.",
].join("\n");

test("screen 201b: the work section of the brief is shown open as an example", async () => {
  preview = {
    ...PREVIEW,
    brief: `# BOU-15\n\n## Commits de la branche\n(aucun)\n\n${WORK}\n\n## Suite\nrien\n`,
  };
  render(
    <PreviewPane open onClose={() => {}} agentRef="global:livraison" name="livraison" projectId="bou" />,
  );
  const pane = within(await screen.findByRole("dialog", { name: "Ce que reçoit l'agent" }));
  const summary = await pane.findByText("Travail en cours sur le projet (exemple)");
  const details = summary.closest("details");
  expect(details?.open).toBe(true);
  const text = details?.querySelector("pre")?.textContent ?? "";
  expect(text).toBe(WORK);
});

test("a brief without the work section shows nothing more", async () => {
  render(
    <PreviewPane open onClose={() => {}} agentRef="global:livraison" name="livraison" projectId="bou" />,
  );
  const pane = within(await screen.findByRole("dialog"));
  await pane.findByRole("button", { name: "brief.md" });
  expect(pane.queryByText("Travail en cours sur le projet (exemple)")).toBeNull();
});
