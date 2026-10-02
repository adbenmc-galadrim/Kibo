import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, RpcRequest, RunView, StatusId } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, kiboProject, NOW, runFixture } from "./fixtures";
import { chatBox } from "./run-chat";

const calls: RpcRequest[] = [];
let status: StatusId = "in_progress";
let access: "write" | "read" = "write";

const project = () => {
  const snapshot = kiboProject();
  return {
    ...snapshot,
    tickets: snapshot.tickets.map((t) => (t.id === "t14" ? { ...t, statusId: status } : t)),
    sync: { ...snapshot.sync, access },
  };
};

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return Promise.resolve(req.method === "getProject" ? project() : null);
    },
    subscribe: () => () => {},
    code: () => Promise.resolve([]),
    subscribeCode: () => () => {},
  },
}));

const unmockedProjects = "../state/use-projects?unmocked";
const realProjects: typeof import("../state/use-projects") = await import(unmockedProjects);
mock.module("../state/use-projects", () => ({
  useProject: realProjects.useProject,
  useProjects: realProjects.useProjects,
}));

const { AgentDrawer } = await import("./AgentDrawer");

beforeEach(() => {
  calls.length = 0;
  status = "in_progress";
  access = "write";
});

const ticketRun = (p: Partial<RunView>): RunView =>
  runFixture({
    id: "r50",
    seq: 50,
    projectId: "kibo",
    ticketId: "t14",
    ticketKey: "KIB-14",
    ticketTitle: "Récepteur de hooks Claude Code",
    label: "opus-dev-2",
    startedAt: NOW - 10 * 60_000,
    turns: 1,
    ...p,
  });

const drawer = (run: RunView, resumable: string[] = []) => {
  const state: AgentsState = { ...agentsFixture(), runs: [run], queue: [], resumable };
  return (
    <AgentDrawer
      state={state}
      now={NOW}
      selected={run}
      log={[]}
      onSelect={() => {}}
      onCollapse={() => {}}
      onLaunch={() => {}}
      onOpenFile={() => {}}
    />
  );
};

test("the box answers a question, writes to a resumable run, waits during a turn", () => {
  const ended = ticketRun({ state: "done", endedAt: NOW });
  expect(chatBox(ticketRun({ state: "waiting_input" }), false)).toEqual({ mode: "answer", busy: false });
  expect(chatBox(ended, true)).toEqual({ mode: "write", busy: false });
  expect(chatBox(ended, false)).toBeNull();
  for (const state of ["queued", "starting", "running"] as const) {
    expect(chatBox(ticketRun({ state }), false)).toEqual({ mode: "write", busy: true });
  }
  const task = ticketRun({ projectId: null, ticketId: null, ticketKey: null });
  expect(chatBox({ ...task, state: "running" }, false)).toBeNull();
  expect(chatBox({ ...task, state: "waiting_input" }, false)).toEqual({ mode: "answer", busy: false });
});

test("a finished run can be written to and sent to review from the drawer", async () => {
  const run = ticketRun({ state: "done", endedAt: NOW });
  render(drawer(run, [run.id]));
  const user = userEvent.setup();
  expect(screen.getByText("Écrire à l'agent")).toBeTruthy();
  await user.type(screen.getByLabelText("Écrire à opus-dev-2"), "Ajoute les tests");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(calls).toContainEqual({ method: "answerRun", runId: "r50", text: "Ajoute les tests" });

  await user.click(await screen.findByRole("button", { name: "Passer en review" }));
  expect(calls).toContainEqual({
    method: "command",
    projectId: "kibo",
    command: { method: "setStatus", ticketId: "t14", statusId: "in_review" },
  });
});

test("during a turn the box is disabled and says why", async () => {
  render(drawer(ticketRun({ state: "running" })));
  const field = screen.getByLabelText<HTMLInputElement>("Écrire à opus-dev-2");
  expect(field.disabled).toBe(true);
  expect(screen.getByRole<HTMLButtonElement>("button", { name: "Envoyer" }).disabled).toBe(true);
  expect(screen.getByText("L'agent travaille : écris-lui à la fin de son tour, ou arrête-le.")).toBeTruthy();
  expect(await screen.findByRole("button", { name: "Passer en review" })).toBeTruthy();
});

test("a run that cannot resume has no box; a ticket already in review has no review button", async () => {
  status = "in_review";
  render(drawer(ticketRun({ state: "failed", endedAt: NOW, error: "exit code 1" })));
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  await Promise.resolve();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button", { name: "Passer en review" })).toBeNull();
});

test("a waiting run is answered under the « Répondre » title", () => {
  render(drawer(ticketRun({ state: "waiting_input", question: "Quel port ?" })));
  expect(screen.getByText("Répondre")).toBeTruthy();
  expect(screen.getByLabelText("Réponse à opus-dev-2")).toBeTruthy();
});

test("without write access to the project there is no review button", async () => {
  access = "read";
  render(drawer(ticketRun({ state: "done", endedAt: NOW }), ["r50"]));
  await waitFor(() => expect(calls.some((c) => c.method === "getProject")).toBe(true));
  await Promise.resolve();
  expect(screen.queryByRole("button", { name: "Passer en review" })).toBeNull();
  expect(screen.getByLabelText("Écrire à opus-dev-2")).toBeTruthy();
});
