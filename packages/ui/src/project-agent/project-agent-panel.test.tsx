import { beforeEach, expect, mock, test } from "bun:test";
import type { ProjectAgentView, RpcRequest, RunLogEntry, SignalsView } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import type { ProjectAgentTab } from "../shell/use-project-agent-panel";
import { CONVERSATION_LOG, emisProject, emptyView, pendingBatch, projectRun, viewFixture } from "./fixtures";
import { emptySignals, signalsView } from "./signals/fixtures";

const calls: RpcRequest[] = [];
let current: ProjectAgentView = viewFixture();
let past: ProjectAgentView = viewFixture();
let log: RunLogEntry[] = CONVERSATION_LOG;
let signals: SignalsView = signalsView();

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProjectAgent") return Promise.resolve(req.runId ? past : current);
        if (req.method === "getRunLog") return Promise.resolve(log);
        if (req.method === "listSignals") return Promise.resolve(signals);
        if (req.method === "decideBatch") return Promise.resolve(pendingBatch({ status: "rejected" }));
        if (req.method === "resetProjectAgent") return Promise.resolve(emptyView());
        if (req.method === "agents.list")
          return Promise.resolve({ agents: [], notices: [], partialWatch: false });
        return Promise.resolve(projectRun({ state: "queued" }));
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { ProjectAgentPanel } = await import("./ProjectAgentPanel");

const opened: string[] = [];
const views: string[] = [];
const host: Host = {
  openTicket: (id) => opened.push(id),
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: (id) => views.push(id),
  openTarget: () => {},
};

beforeEach(() => {
  localStorage.clear();
  calls.length = 0;
  opened.length = 0;
  views.length = 0;
  current = viewFixture();
  past = viewFixture({
    session: viewFixture().past[0] ?? null,
    run: projectRun({ id: "pa0", state: "done" }),
    batches: [pendingBatch({ id: "b-old", status: "abandoned", runId: "pa0" })],
    past: [],
  });
  log = CONVERSATION_LOG;
  signals = signalsView();
});

function Panel({ initial }: { initial: ProjectAgentTab }) {
  const [tab, setTab] = useState(initial);
  return <ProjectAgentPanel open project={emisProject()} tab={tab} onTab={setTab} onClose={() => {}} />;
}

const show = (initial: ProjectAgentTab = "conversation") =>
  render(
    <HostProvider host={host}>
      <Panel initial={initial} />
    </HostProvider>,
  );
const panel = () => within(screen.getByRole("dialog"));
const rpcs = (method: string) => calls.filter((c) => c.method === method);

async function choose(item: string) {
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: item }));
}

const toConversation = async () => {
  await choose("Conversation");
  await panel().findByRole("tablist");
};

test("the conversation is rendered with its batch card", async () => {
  show();
  await toConversation();
  expect(await panel().findByText("Où en est-on ?")).toBeTruthy();
  expect(panel().getByText("lit les tickets, lit EMIS-11")).toBeTruthy();
  expect(panel().getByRole("region", { name: /Lot n° 1/ })).toBeTruthy();
  await userEvent.setup().click(await panel().findByRole("button", { name: "EMIS-11" }));
  expect(opened).toEqual(["t11"]);
});

test("the agent's markdown never injects HTML", async () => {
  log = [
    {
      id: 1,
      at: 1,
      event: {
        type: "exited",
        code: 0,
        isError: false,
        result: "<script>alert(1)</script>",
        tokens: 0,
        costUsd: 0,
        denied: [],
      },
    },
  ];
  current = viewFixture({ run: projectRun({ state: "done" }), batches: [] });
  show();
  expect(await panel().findByText("<script>alert(1)</script>")).toBeTruthy();
  expect(document.querySelector("[role=dialog] script")).toBeNull();
});

test("Enter adds a line, ⌘↵ sends the message", async () => {
  show();
  await toConversation();
  const box = await panel().findByRole("combobox", { name: "Message à l'agent de projet" });
  expect(box.getAttribute("placeholder")).toBe("Écris à l'agent de projet…");
  const user = userEvent.setup();
  await user.type(box, "Bonjour{Enter}la suite");
  expect(rpcs("sendProjectAgentMessage")).toHaveLength(0);
  await user.keyboard("{Meta>}{Enter}{/Meta}");
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "emis", text: "Bonjour\nla suite" },
    ]),
  );
  await waitFor(() => expect((box as HTMLTextAreaElement).value).toBe(""));
});

test("without a session the box invites to ask about the project and the state is Prêt", async () => {
  current = emptyView();
  log = [];
  show();
  await toConversation();
  const box = await panel().findByRole("combobox", { name: "Message à l'agent de projet" });
  await waitFor(() => expect(box.getAttribute("placeholder")).toBe("Demande quelque chose sur Emis…"));
  expect(panel().getByText("Prêt")).toBeTruthy();
  expect(panel().getByText("Aucun message pour l'instant.")).toBeTruthy();
});

test("Réessayer sends the last message again", async () => {
  current = viewFixture({ batches: [] });
  show();
  await toConversation();
  await userEvent.setup().click(await panel().findByRole("button", { name: "Réessayer" }));
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "emis", text: "Et l'export ?" },
    ]),
  );
});

test("deciding a batch calls decideBatch for this project", async () => {
  show();
  await toConversation();
  const user = userEvent.setup();
  const card = within(await panel().findByRole("region", { name: /Lot n° 1/ }));
  await user.click(card.getByRole("button", { name: "Refuser" }));
  await user.click(card.getByRole("button", { name: "Confirmer le refus" }));
  await waitFor(() =>
    expect(rpcs("decideBatch")).toEqual([
      { method: "decideBatch", projectId: "emis", batchId: "b1", decision: "reject" },
    ]),
  );
});

test("Nouvel agent de projet asks for confirmation, then resets", async () => {
  show();
  const user = userEvent.setup();
  await choose("Nouvel agent de projet");
  const confirm = await screen.findByRole("alertdialog");
  expect(rpcs("resetProjectAgent")).toHaveLength(0);
  await user.click(within(confirm).getByRole("button", { name: "Nouvel agent" }));
  await waitFor(() =>
    expect(rpcs("resetProjectAgent")).toEqual([{ method: "resetProjectAgent", projectId: "emis" }]),
  );
});

test("the recap of a validated batch goes away with a new project agent", async () => {
  show();
  const user = userEvent.setup();
  await panel().findByText("Mettre à jour la note agent-de-projet/memoire.md");
  await user.click(panel().getByRole("button", { name: /^Valider/ }));
  await waitFor(() => expect(rpcs("decideBatch")).toHaveLength(1));
  expect(await panel().findByRole("region", { name: /validé$/ })).toBeTruthy();
  current = emptyView();
  await choose("Nouvel agent de projet");
  await user.click(
    within(await screen.findByRole("alertdialog")).getByRole("button", { name: "Nouvel agent" }),
  );
  await waitFor(() => expect(panel().queryByRole("region", { name: /validé$/ })).toBeNull());
});

test("Anciens agents lists past sessions, opens one read-only, then goes back", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: "Anciens agents" }));
  await user.click(await panel().findByRole("button", { name: /^Session du/ }));
  expect(await panel().findByText("Ancien agent · lecture seule")).toBeTruthy();
  expect(rpcs("getProjectAgent").at(-1)).toEqual({
    method: "getProjectAgent",
    projectId: "emis",
    runId: "pa0",
  });
  expect(panel().queryByRole("combobox", { name: "Message à l'agent de projet" })).toBeNull();
  expect(await panel().findByText("Abandonné")).toBeTruthy();
  await user.click(panel().getByRole("button", { name: "Retour" }));
  expect(await panel().findByRole("combobox", { name: "Message à l'agent de projet" })).toBeTruthy();
});

test("Ouvrir la mémoire opens the Notes view", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: "Ouvrir la mémoire" }));
  expect(views).toEqual(["notes"]);
});

test("the panel is 340 px wide by default", async () => {
  show();
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("340px"));
});

test("the width is bounded, remembered, and the edge resizes with Shift+arrows", async () => {
  localStorage.setItem("kibo.projectAgent.width", "9999");
  show();
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("720px"));
  const edge = panel().getByRole("button", { name: "Redimensionner le panneau" });
  edge.focus();
  const user = userEvent.setup();
  await user.keyboard("{Shift>}{ArrowRight}{/Shift}");
  expect(screen.getByRole("dialog").style.width).toBe("704px");
  expect(localStorage.getItem("kibo.projectAgent.width")).toBe("704");
  await user.keyboard("{Shift>}{ArrowLeft}{/Shift}{Shift>}{ArrowLeft}{/Shift}");
  expect(screen.getByRole("dialog").style.width).toBe("720px");
  localStorage.setItem("kibo.projectAgent.width", "10");
  window.dispatchEvent(new StorageEvent("storage", { key: "kibo.projectAgent.width" }));
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("340px"));
});

test("two tabs: Conversation, and Signaux with the open count; the compose box stays under Conversation", async () => {
  show();
  await toConversation();
  const user = userEvent.setup();
  expect(await panel().findByRole("tab", { name: "Signaux · 3" })).toBeTruthy();
  expect(panel().getByRole("tab", { name: "Conversation", selected: true })).toBeTruthy();
  await user.click(panel().getByRole("tab", { name: "Signaux · 3" }));
  expect(await panel().findByRole("region", { name: "En boîte · 3" })).toBeTruthy();
  expect(panel().queryByRole("combobox", { name: "Message à l'agent de projet" })).toBeNull();
});

test("tab signals opens the box directly, and an empty box has no zero count", async () => {
  signals = emptySignals();
  show("signals");
  expect(await panel().findByText(/^Aucun signal\./)).toBeTruthy();
  expect(panel().getByRole("tab", { name: "Signaux", selected: true })).toBeTruthy();
});

test("a batch after a wakeup says so, names the source of each action and groups dismissals", async () => {
  log = [
    {
      id: 1,
      at: 1,
      event: { type: "answered", text: "Réveil automatique : 3 signaux à traiter (…).", rank: 0 },
    },
  ];
  const actions = [
    { id: 1, type: "createTicket" as const, ref: "new:1", title: "Tests", why: "", signals: ["sig:1"] },
    { id: 2, type: "dismissSignal" as const, signal: "sig:3", why: "Déjà connu" },
  ];
  current = viewFixture({ batches: [pendingBatch({ createdAt: 2, actions, expected: [] })] });
  show();
  await toConversation();
  expect(await panel().findByText("Réveil automatique · 3 signaux")).toBeTruthy();
  const card = within(await panel().findByRole("region", { name: /Lot n° 1/ }));
  expect(card.getByText("2 actions · après réveil")).toBeTruthy();
  expect(await card.findByText("signal Ticket à créer de")).toBeTruthy();
  expect(card.getByRole("button", { name: /opus-dev-2/ })).toBeTruthy();
  const group = within(card.getByRole("group", { name: "Signaux" }));
  expect(group.getByText("Signal sig:3 : sans suite")).toBeTruthy();
});
