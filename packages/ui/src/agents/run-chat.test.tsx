import { beforeEach, expect, mock, test } from "bun:test";
import { type AgentsState, KiboError, type RpcRequest, type RunView, type StatusId } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { agentsFixture, kiboProject, NOW, runFixture } from "./fixtures";
import { chatBox } from "./run-chat";

const calls: RpcRequest[] = [];
let status: StatusId = "in_progress";
let access: "write" | "read" = "write";
let answer: () => Promise<unknown> = () => Promise.resolve(null);

const project = () => {
  const snapshot = kiboProject();
  return {
    ...snapshot,
    tickets: snapshot.tickets.map((t) => (t.id === "t14" ? { ...t, statusId: status } : t)),
    sync: { ...snapshot.sync, access },
  };
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "answerRun") return answer();
        return Promise.resolve(req.method === "getProject" ? project() : null);
      },
      subscribe: () => () => {},
      code: () => Promise.resolve([]),
      subscribeCode: () => () => {},
    },
  }),
);

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
  answer = () => Promise.resolve(null);
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
  expect(chatBox(ticketRun({ state: "waiting_input" }), false)).toEqual({ mode: "answer", pending: false });
  expect(chatBox(ended, true)).toEqual({ mode: "write", pending: false });
  expect(chatBox(ended, false)).toBeNull();
  for (const state of ["queued", "starting", "running"] as const) {
    expect(chatBox(ticketRun({ state }), false)).toEqual({ mode: "write", pending: true });
  }
  const task = ticketRun({ projectId: null, ticketId: null, ticketKey: null });
  expect(chatBox({ ...task, state: "running" }, false)).toBeNull();
  expect(chatBox({ ...task, state: "waiting_input" }, false)).toEqual({ mode: "answer", pending: false });
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

test("resuming a run whose ticket already has an active run says why", async () => {
  answer = () => Promise.reject(new KiboError("CONFLICT", "ticket KIB-14 already has an active run"));
  const run = ticketRun({ state: "done", endedAt: NOW });
  render(drawer(run, [run.id]));
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Écrire à opus-dev-2"), "Ajoute les tests");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Un run de ce ticket est déjà en cours ou en file.",
  );
});

test("during a turn the box stays open, says the message waits for the next turn, and sends it", async () => {
  render(drawer(ticketRun({ state: "running" })));
  const user = userEvent.setup();
  const field = screen.getByLabelText<HTMLInputElement>("Écrire à opus-dev-2");
  expect(field.disabled).toBe(false);
  expect(
    screen.getByText("L'agent travaille : ton message lui sera remis au début de son prochain tour."),
  ).toBeTruthy();
  await user.type(field, "Ajoute les tests");
  await user.click(screen.getByRole("button", { name: "Envoyer" }));
  expect(calls).toContainEqual({ method: "answerRun", runId: "r50", text: "Ajoute les tests" });
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

test("a demo run says in the drawer that it spends no token, another run does not", () => {
  const { unmount } = render(drawer(ticketRun({ profileId: "demo", label: "demo-1" })));
  expect(screen.getByText("Agent de démonstration · aucun token consommé")).toBeTruthy();
  unmount();
  render(drawer(ticketRun({})));
  expect(screen.queryByText("Agent de démonstration · aucun token consommé")).toBeNull();
});
