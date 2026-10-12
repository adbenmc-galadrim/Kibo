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
    subagents: ["livraison", "review"],
    skills: { mode: "list", ids: ["porte-qualite"] },
  },
};
const calls: RpcRequest[] = [];

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProject") return Promise.resolve(kiboProject());
        if (req.method === "agents.preview") return Promise.resolve(PREVIEW);
        return Promise.resolve(null);
      },
    },
  }),
);

const { PreviewPane } = await import("./PreviewPane");

beforeEach(() => {
  calls.length = 0;
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
    "livraison, review",
    "porte-qualite",
  ]);
  expect(calls).toContainEqual({ method: "agents.preview", ref: "global:chef-orchestre", projectId: "kibo" });
  expect(pane.getByText("Aucun secret : ni le jeton du run ni les variables d'environnement.")).toBeTruthy();
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
