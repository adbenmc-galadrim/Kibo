import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, FileRef, RpcRequest, RunPeek, TabTarget, Worktree } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { apiMock } from "../../api-mock";
import { dockState, FEED_RUN, MOMENTS_PAGE, progressProject, REPORTED_RUN } from "../../moments/fixtures";
import { parallelFixture } from "../../overlaps/fixtures";
import { type Host, HostProvider } from "../../shell/Host";
import { AgentsProvider } from "../../state/agents-context";

const PEEK: RunPeek = {
  runId: FEED_RUN,
  label: "opus-dev-2",
  profileName: "opus-dev",
  state: "waiting_input",
  ticketKey: "KIB-14",
  ticketTitle: "Récepteur de hooks Claude Code",
  step: { index: 2, total: 5, title: "Corriger la validation du corps" },
  lastMessage: "Un test échoue encore : quel port veux-tu pour le récepteur ?",
  waiting: true,
};

const calls: RpcRequest[] = [];
const worktrees: Worktree[] = [
  { path: "/Users/adam/goinfre/Kibo", branch: "main", head: "a1", isMain: true },
];

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "runPeek") return Promise.resolve({ ...PEEK, runId: req.runId });
        if (req.method === "overlaps.parallel")
          return Promise.resolve(parallelFixture({ runs: [], overlaps: [] }));
        if (req.method === "getProject") return Promise.resolve(progressProject());
        if (req.method === "runMoments")
          return Promise.resolve(req.runId === FEED_RUN ? MOMENTS_PAGE : { ...MOMENTS_PAGE, moments: [] });
        if (req.method === "getRunLog") return Promise.resolve([]);
        return Promise.resolve(null);
      },
      code: () => Promise.resolve(worktrees),
      subscribe: () => () => {},
      subscribeCode: () => () => {},
      subscribeTopic: () => () => {},
      subscribeMoments: () => () => {},
    },
  }),
);

const unmockedProjects = "../../state/use-projects?unmocked";
const realProjects: typeof import("../../state/use-projects") = await import(unmockedProjects);
mock.module("../../state/use-projects", () => ({
  useProject: realProjects.useProject,
  useProjects: realProjects.useProjects,
}));

const unmockedRunLog = "../../state/use-run-log?unmocked";
const realRunLog: typeof import("../../state/use-run-log") = await import(unmockedRunLog);
mock.module("../../state/use-run-log", () => realRunLog);

const { Mention } = await import("./Mention");
const { RunSidePanel } = await import("./RunSidePanel");

type Spies = {
  openRun: ReturnType<typeof mock<(runId: string) => void>>;
  answerRun: ReturnType<typeof mock<(runId: string) => void>>;
  openTarget: ReturnType<typeof mock<(t: TabTarget) => void>>;
  openFile: ReturnType<typeof mock<(ref: FileRef) => void>>;
};

function hostOf(spies: Spies): Host {
  return {
    openTicket: () => {},
    openNewTicket: () => {},
    openAssign: () => {},
    openFile: spies.openFile,
    openView: () => {},
    openTarget: spies.openTarget,
    openRun: spies.openRun,
    answerRun: spies.answerRun,
  };
}

function withShell(children: ReactNode, state: AgentsState | null = dockState()) {
  const spies: Spies = {
    openRun: mock((_: string) => {}),
    answerRun: mock((_: string) => {}),
    openTarget: mock((_: TabTarget) => {}),
    openFile: mock((_: FileRef) => {}),
  };
  render(
    <HostProvider host={hostOf(spies)}>
      <AgentsProvider agents={state}>{children}</AgentsProvider>
    </HostProvider>,
  );
  return spies;
}

beforeEach(() => {
  calls.length = 0;
  window.localStorage.clear();
  location.hash = "";
});

test("hovering a mention peeks the run from the daemon and shows its card", async () => {
  withShell(<Mention runId={FEED_RUN} label="opus-dev-2" state="waiting_input" />);
  fireEvent.pointerEnter(screen.getByRole("button", { name: "opus-dev-2" }));
  expect(
    await screen.findByText("2/5 · Corriger la validation du corps", {}, { timeout: 2000 }),
  ).toBeTruthy();
  expect(calls).toContainEqual({ method: "runPeek", runId: FEED_RUN });
  expect(screen.getByText("Un test échoue encore : quel port veux-tu pour le récepteur ?")).toBeTruthy();
});

test("the keyboard focus opens the card at once", async () => {
  withShell(<Mention runId={FEED_RUN} label="opus-dev-2" />);
  fireEvent.focus(screen.getByRole("button", { name: "opus-dev-2" }));
  expect(await screen.findByRole("button", { name: "Voir l'historique" })).toBeTruthy();
});

test("a click on the mention opens the run's side panel through the host", async () => {
  const spies = withShell(<Mention runId={FEED_RUN} label="opus-dev-2" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "opus-dev-2" }));
  expect(spies.openRun).toHaveBeenCalledWith(FEED_RUN);
});

test("a waiting run's card offers to reply", async () => {
  const spies = withShell(<Mention runId={FEED_RUN} label="opus-dev-2" />);
  fireEvent.focus(screen.getByRole("button", { name: "opus-dev-2" }));
  await userEvent.setup().click(await screen.findByRole("button", { name: "Répondre" }));
  expect(spies.answerRun).toHaveBeenCalledWith(FEED_RUN);
});

function renderPanel(runId = FEED_RUN, state: AgentsState | null = dockState()) {
  const onClose = mock(() => {});
  const onOpenTicket = mock((_p: string, _t: string) => {});
  const spies = withShell(
    <RunSidePanel runId={runId} onClose={onClose} onOpenTicket={onOpenTicket} />,
    state,
  );
  const panel = within(screen.getByRole("dialog"));
  return { onClose, onOpenTicket, panel, ...spies };
}

test("the side panel names the run, its state and its ticket, which opens", async () => {
  const { panel, onOpenTicket } = renderPanel();
  expect(panel.getByRole("heading", { name: "opus-dev-2" })).toBeTruthy();
  expect(panel.getAllByText("Attend une réponse").length).toBeGreaterThan(0);
  await userEvent
    .setup()
    .click(panel.getByRole("button", { name: "KIB-14 · Récepteur de hooks Claude Code" }));
  expect(onOpenTicket).toHaveBeenCalledWith("kibo", "t14");
});

test("the side panel shows the plan, the feed without reasoning and the report", async () => {
  const { panel } = renderPanel();
  expect(await panel.findByText("Je relis le récepteur et ses tests avant de toucher au port.")).toBeTruthy();
  expect(panel.getByText("Corriger la validation du corps")).toBeTruthy();
  expect(panel.getByText("ticket_progress")).toBeTruthy();
  expect(panel.queryByText("Le corps vide passe parce que le test ne couvre que null.")).toBeNull();
  expect(panel.getByRole("region", { name: "Compte rendu" })).toBeTruthy();
  expect(calls).toContainEqual({ method: "runMoments", runId: FEED_RUN });
});

test("the side panel lists the runs of the same ticket as mentions, newest first", () => {
  const { panel } = renderPanel();
  const history = within(panel.getByRole("list", { name: "Runs du ticket" }));
  const rows = history.getAllByRole("listitem");
  expect(rows.map((r) => r.getAttribute("data-run"))).toEqual([FEED_RUN, REPORTED_RUN]);
  expect(rows[0]?.getAttribute("aria-current")).toBe("true");
  expect(history.getAllByRole("button", { name: "opus-dev-2" })).toHaveLength(2);
});

test("« Ouvrir en grand » opens the run's own page and closes the panel", async () => {
  const { panel, onClose } = renderPanel();
  await userEvent.setup().click(panel.getByRole("button", { name: "Ouvrir en grand" }));
  expect(location.hash).toBe(`#/runs/${FEED_RUN}`);
  expect(onClose).toHaveBeenCalled();
});

test("Escape and the close button close the side panel", async () => {
  const { panel, onClose } = renderPanel();
  await userEvent.setup().keyboard("{Escape}");
  expect(onClose).toHaveBeenCalledTimes(1);
  await userEvent.setup().click(panel.getByRole("button", { name: "Fermer" }));
  expect(onClose).toHaveBeenCalledTimes(2);
});

test("an unknown run says so in the side panel", async () => {
  const { panel } = renderPanel("nope");
  expect(panel.getByText("Run introuvable")).toBeTruthy();
  await waitFor(() => expect(calls.some((c) => c.method === "runMoments")).toBe(false));
});

test("screen 200: the side panel shows the work in parallel after the report", async () => {
  const { panel } = renderPanel();
  const section = await panel.findByRole("region", { name: "Travail en parallèle" });
  expect(await within(section).findByText("Aucun autre run sur ce projet")).toBeTruthy();
  const report = panel.getByRole("region", { name: "Compte rendu" });
  expect(report.compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
