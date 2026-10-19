import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import type { ProjectAgentView, RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { NOW } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";
import { CONVERSATION_LOG, pendingBatch, projectRun, session, siloProject, viewFixture } from "./fixtures";
import { signalsView } from "./signals/fixtures";

const calls: RpcRequest[] = [];
let current: ProjectAgentView = viewFixture();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProjectAgent") return Promise.resolve(current);
        if (req.method === "getRunLog") return Promise.resolve(CONVERSATION_LOG);
        if (req.method === "listSignals") return Promise.resolve(signalsView());
        if (req.method === "agents.list")
          return Promise.resolve({ agents: [], notices: [], partialWatch: false });
        if (req.method === "skills.suggest") return Promise.resolve({ skills: [] });
        return Promise.resolve(projectRun({ state: "queued" }));
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { ProjectAgentPanel } = await import("./ProjectAgentPanel");

const host: Host = {
  openTicket: () => {},
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: () => {},
  openTarget: () => {},
};

afterEach(() => setSystemTime());
beforeEach(() => {
  setSystemTime(new Date(NOW));
  localStorage.clear();
  calls.length = 0;
  current = viewFixture();
});

function Panel() {
  const [tab, setTab] = useState<ProjectAgentTab>("conversation");
  return <ProjectAgentPanel open project={siloProject()} tab={tab} onTab={setTab} onClose={() => {}} />;
}

const show = () =>
  render(
    <HostProvider host={host}>
      <Panel />
    </HostProvider>,
  );
const panel = () => within(screen.getByRole("dialog"));
const rpcs = (method: string) => calls.filter((c) => c.method === method);

async function choose(item: string) {
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

test("Suivi is the default view: last turn, summary, last question, pending batch, footer and box", async () => {
  current = viewFixture({ session: session({ lastTurnAt: Date.now() - 4 * 60_000 }), run: projectRun() });
  show();
  expect(await panel().findByText("Agent de projet")).toBeTruthy();
  expect(await panel().findByText("Suivi à jour · il y a 4 min")).toBeTruthy();
  const summary = within(panel().getByRole("region", { name: "Résumé du jour" }));
  expect(await summary.findByText(/avance ; je propose de le passer en review\./)).toBeTruthy();
  expect(await panel().findByText("Et l'export ?")).toBeTruthy();
  const todo = within(await panel().findByRole("region", { name: "Lot n° 1" }));
  expect(todo.getByText("7 actions")).toBeTruthy();
  expect(todo.getByRole("button", { name: "Valider (7)" })).toBeTruthy();
  expect(panel().queryByRole("tablist")).toBeNull();
  const box = panel().getByRole("combobox", { name: "Message à l'agent de projet" });
  expect(box.getAttribute("placeholder")).toBe("Demander à l'agent de projet…");
  const user = userEvent.setup();
  await user.type(box, "Et F5 ?{Enter}");
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "silo", text: "Et F5 ?" },
    ]),
  );
});

test("the ⋯ menu holds the tabs and the former entries; Conversation shows the tabs, Suivi comes back", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  const items = (await screen.findAllByRole("menuitem")).map((i) => i.textContent);
  expect(items).toEqual([
    "Conversation",
    "Signaux · 3",
    "Anciens agents",
    "Nouvel agent de projet",
    "Ouvrir la mémoire",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Conversation" }));
  expect(await panel().findByRole("tab", { name: "Conversation", selected: true })).toBeTruthy();
  expect(await panel().findByText("Où en est-on ?")).toBeTruthy();
  expect(panel().queryByRole("region", { name: "Résumé du jour" })).toBeNull();
  await choose("Suivi");
  expect(await panel().findByRole("region", { name: "Résumé du jour" })).toBeTruthy();
  expect(panel().queryByRole("tablist")).toBeNull();
});

test("superseded batches stay hidden in the conversation until the ⋯ menu shows them", async () => {
  current = viewFixture({
    batches: [pendingBatch(), pendingBatch({ id: "b-old", seq: 4, status: "superseded" })],
  });
  show();
  expect(await panel().findByText("1 lot remplacé masqué")).toBeTruthy();
  await choose("Conversation");
  expect(await panel().findByRole("region", { name: "Lot n° 1" })).toBeTruthy();
  expect(panel().queryByRole("region", { name: "Lot n° 4" })).toBeNull();
  await choose("Afficher les lots remplacés");
  expect(await panel().findByRole("region", { name: "Lot n° 4" })).toBeTruthy();
  await choose("Masquer les lots remplacés");
  await waitFor(() => expect(panel().queryByRole("region", { name: "Lot n° 4" })).toBeNull());
});

test("Afficher les lots remplacés from Suivi opens the conversation with them", async () => {
  current = viewFixture({
    batches: [pendingBatch(), pendingBatch({ id: "b-old", seq: 4, status: "superseded" })],
  });
  show();
  await userEvent.setup().click(await panel().findByRole("button", { name: "Afficher les lots remplacés" }));
  expect(await panel().findByRole("tab", { name: "Conversation", selected: true })).toBeTruthy();
  expect(await panel().findByRole("region", { name: "Lot n° 4" })).toBeTruthy();
});
