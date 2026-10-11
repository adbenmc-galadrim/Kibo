import { beforeEach, expect, mock, test } from "bun:test";
import type { AgentsState, RpcRequest, Worktree } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { dockState, FEED_RUN, MOMENTS_PAGE, progressProject } from "../../moments/fixtures";
import { type Host, HostProvider } from "../../shell/Host";
import { AgentsProvider } from "../../state/agents-context";

const calls: RpcRequest[] = [];
const worktrees: Worktree[] = [
  { path: "/Users/adam/goinfre/Kibo", branch: "main", head: "a1", isMain: true },
];

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
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

const { RunPage } = await import("./RunPage");

const host: Host = {
  openTicket: () => {},
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: () => {},
  openTarget: () => {},
  openRun: () => {},
};

function renderPage(runId = FEED_RUN, state: AgentsState | null = dockState()) {
  render(
    <HostProvider host={host}>
      <AgentsProvider agents={state}>
        <RunPage runId={runId} />
      </AgentsProvider>
    </HostProvider>,
  );
}

const REASONING = "Le corps vide passe parce que le test ne couvre que null.";

beforeEach(() => {
  calls.length = 0;
  window.localStorage.clear();
});

test("the page heads with the run, its state and its profile", () => {
  renderPage();
  expect(screen.getByRole("heading", { name: "opus-dev-2" })).toBeTruthy();
  expect(screen.getByText("Profil opus-dev")).toBeTruthy();
  expect(screen.getByRole("button", { name: "KIB-14 · Récepteur de hooks Claude Code" })).toBeTruthy();
});

test("the history lists every run of the same profile, newest first, each as a mention", () => {
  renderPage();
  const history = within(screen.getByRole("list", { name: "Historique des runs" }));
  const expected = dockState()
    .runs.filter((r) => r.profileId === "opus")
    .sort((a, b) => b.createdAt - a.createdAt || b.seq - a.seq)
    .map((r) => r.id);
  const rows = history.getAllByRole("listitem");
  expect(rows.map((r) => r.getAttribute("data-run"))).toEqual(expected);
  for (const row of rows) expect(within(row).getAllByRole("button").length).toBeGreaterThan(0);
  expect(rows.find((r) => r.getAttribute("data-run") === FEED_RUN)?.getAttribute("aria-current")).toBe(
    "true",
  );
});

test("the page shows the whole feed, the plan and the report", async () => {
  renderPage();
  expect(
    await screen.findByText("Je relis le récepteur et ses tests avant de toucher au port."),
  ).toBeTruthy();
  expect(screen.getByText("Un test échoue encore : quel port veux-tu pour le récepteur ?")).toBeTruthy();
  expect(screen.getByText("Corriger la validation du corps")).toBeTruthy();
  expect(screen.getByRole("region", { name: "Compte rendu" })).toBeTruthy();
});

test("the reasoning stays hidden until asked, and the choice is remembered", async () => {
  renderPage();
  await screen.findByText("Je relis le récepteur et ses tests avant de toucher au port.");
  expect(screen.queryByText(REASONING)).toBeNull();
  await userEvent.setup().click(screen.getByRole("checkbox", { name: "Afficher le raisonnement" }));
  expect(screen.getByText(REASONING)).toBeTruthy();
  expect(window.localStorage.getItem("kibo.run.reasoning")).toBe("1");
});

test("the reasoning preference is read when the page opens", async () => {
  window.localStorage.setItem("kibo.run.reasoning", "1");
  renderPage();
  expect(await screen.findByText(REASONING)).toBeTruthy();
});

test("an unknown run says so", () => {
  renderPage("nope");
  expect(screen.getByText("Run introuvable")).toBeTruthy();
  expect(calls.some((c) => c.method === "runMoments")).toBe(false);
});

test("nothing is claimed missing while the agents are still loading", () => {
  renderPage(FEED_RUN, null);
  expect(screen.queryByText("Run introuvable")).toBeNull();
});
