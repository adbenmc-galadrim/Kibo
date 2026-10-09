import { beforeEach, expect, mock, test } from "bun:test";
import type { ProjectAgentView, RpcRequest, RunLogEntry } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";
import { CONVERSATION_LOG, emisProject, emptyView, pendingBatch, projectRun, viewFixture } from "./fixtures";

const calls: RpcRequest[] = [];
let current: ProjectAgentView = viewFixture();
let past: ProjectAgentView = viewFixture();
let log: RunLogEntry[] = CONVERSATION_LOG;

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProjectAgent") return Promise.resolve(req.runId ? past : current);
        if (req.method === "getRunLog") return Promise.resolve(log);
        if (req.method === "decideBatch") return Promise.resolve(pendingBatch({ status: "rejected" }));
        if (req.method === "resetProjectAgent") return Promise.resolve(emptyView());
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
});

const show = () =>
  render(
    <HostProvider host={host}>
      <ProjectAgentPanel open project={emisProject()} onClose={() => {}} />
    </HostProvider>,
  );
const panel = () => within(screen.getByRole("dialog"));
const rpcs = (method: string) => calls.filter((c) => c.method === method);

test("the header names the project and the state, the conversation is rendered", async () => {
  show();
  expect(await panel().findByText("Agent de projet · Emis")).toBeTruthy();
  expect(await panel().findByText("Lot à valider")).toBeTruthy();
  expect(await panel().findByText("Où en est-on ?")).toBeTruthy();
  expect(panel().getByText("lit les tickets, lit EMIS-11")).toBeTruthy();
  expect(panel().getByRole("region", { name: /Lot n° 1/ })).toBeTruthy();
  await userEvent.setup().click(panel().getByRole("button", { name: "EMIS-11" }));
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
  const box = await panel().findByRole("textbox", { name: "Message à l'agent de projet" });
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
  const box = await panel().findByRole("textbox", { name: "Message à l'agent de projet" });
  await waitFor(() => expect(box.getAttribute("placeholder")).toBe("Demande quelque chose sur Emis…"));
  expect(panel().getByText("Prêt")).toBeTruthy();
  expect(panel().getByText("Aucun message pour l'instant.")).toBeTruthy();
});

test("Réessayer sends the last message again", async () => {
  current = viewFixture({ batches: [] });
  show();
  await userEvent.setup().click(await panel().findByRole("button", { name: "Réessayer" }));
  await waitFor(() =>
    expect(rpcs("sendProjectAgentMessage")).toEqual([
      { method: "sendProjectAgentMessage", projectId: "emis", text: "Et l'export ?" },
    ]),
  );
});

test("deciding a batch calls decideBatch for this project", async () => {
  show();
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
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: "Nouvel agent de projet" }));
  const confirm = await screen.findByRole("alertdialog");
  expect(rpcs("resetProjectAgent")).toHaveLength(0);
  await user.click(within(confirm).getByRole("button", { name: "Nouvel agent" }));
  await waitFor(() =>
    expect(rpcs("resetProjectAgent")).toEqual([{ method: "resetProjectAgent", projectId: "emis" }]),
  );
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
  expect(panel().queryByRole("textbox", { name: "Message à l'agent de projet" })).toBeNull();
  expect(await panel().findByText("Abandonné")).toBeTruthy();
  await user.click(panel().getByRole("button", { name: "Retour" }));
  expect(await panel().findByRole("textbox", { name: "Message à l'agent de projet" })).toBeTruthy();
});

test("Ouvrir la mémoire opens the Notes view", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await panel().findByRole("button", { name: "Actions de l'agent de projet" }));
  await user.click(await screen.findByRole("menuitem", { name: "Ouvrir la mémoire" }));
  expect(views).toEqual(["notes"]);
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
  await waitFor(() => expect(screen.getByRole("dialog").style.width).toBe("360px"));
});
