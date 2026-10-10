import { beforeEach, expect, mock, test } from "bun:test";
import type { FileRef, RpcRequest, RunMomentsEvent, RunMomentsPage, RunView, Worktree } from "@kibo/schema";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import {
  dockState,
  FEED_RUN,
  MOMENTS,
  MOMENTS_PAGE,
  PLAN,
  progressProject,
  REPORTED_RUN,
  UNREPORTED_RUN,
  WORKTREE,
} from "../../moments/fixtures";
import { NOW } from "../fixtures";

const worktrees: Worktree[] = [
  { path: "/Users/adam/goinfre/Kibo", branch: "main", head: "a1", isMain: true },
  { path: WORKTREE, branch: "kib-14", head: "b2", isMain: false },
];
let page: RunMomentsPage = MOMENTS_PAGE;
let project = progressProject();
const calls: RpcRequest[] = [];
const momentListeners = new Set<(e: RunMomentsEvent) => void>();

mock.module("../../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        if (req.method === "getProject") return Promise.resolve(project);
        if (req.method === "runMoments")
          return Promise.resolve(req.runId === FEED_RUN ? page : { ...page, moments: [] });
        return Promise.resolve(null);
      },
      code: () => Promise.resolve(worktrees),
      subscribe: () => () => {},
      subscribeCode: () => () => {},
      subscribeTopic: () => () => {},
      subscribeMoments: (listener: (e: RunMomentsEvent) => void) => {
        momentListeners.add(listener);
        return () => momentListeners.delete(listener);
      },
    },
  }),
);

const { AgentDock } = await import("./AgentDock");

beforeEach(() => {
  page = MOMENTS_PAGE;
  project = progressProject();
  calls.length = 0;
  window.sessionStorage.clear();
  Object.defineProperty(window, "innerHeight", { configurable: true, value: 1000 });
});

const runOf = (id: string): RunView => {
  const found = dockState().runs.find((r) => r.id === id);
  if (!found) throw new Error(`fixture ${id} missing`);
  return found;
};

function renderDock(selected: string | null = FEED_RUN) {
  const onSelect = mock((_: string) => {});
  const onOpenFile = mock((_: FileRef) => {});
  const onCollapse = mock(() => {});
  render(
    <AgentDock
      state={dockState()}
      now={NOW}
      online
      selected={selected ? runOf(selected) : null}
      onSelect={onSelect}
      onCollapse={onCollapse}
      onLaunch={() => {}}
      onOpenFile={onOpenFile}
    />,
  );
  return { onSelect, onOpenFile, onCollapse };
}

test("the dock shows three columns: runs, feed and plan", () => {
  renderDock();
  for (const name of ["Runs", "Fil", "Plan"]) expect(screen.getByRole("region", { name })).toBeTruthy();
});

test("the runs column lists the active runs, then those finished within 24 hours with their report", async () => {
  const { onSelect } = renderDock();
  const runs = within(screen.getByRole("region", { name: "Runs" }));
  const active = within(runs.getByRole("list", { name: "Actifs · 4" }));
  expect(active.getAllByRole("button").map((b) => b.textContent?.split("KIB")[0])).toEqual([
    "opus-dev-1",
    "opus-dev-3",
    "sonnet-review-1",
    "opus-dev-2",
  ]);
  const recent = within(runs.getByRole("list", { name: /^Terminés depuis 24 h · / }));
  expect(recent.getByText("KIB-14 · fait, 2 points à vérifier, 1 fichier non mentionné")).toBeTruthy();
  expect(recent.getByText("KIB-11 · Pas de compte rendu pour ce run")).toBeTruthy();
  await userEvent.setup().click(recent.getByText("KIB-11 · Pas de compte rendu pour ce run"));
  expect(onSelect).toHaveBeenCalledWith(UNREPORTED_RUN);
});

test("the chosen run's feed is loaded and shown under its actions", async () => {
  renderDock();
  const feed = within(screen.getByRole("region", { name: "Fil" }));
  expect(await feed.findByText("Je relis le récepteur et ses tests avant de toucher au port.")).toBeTruthy();
  expect(feed.getByText("Kibo a rappelé de déclarer le plan")).toBeTruthy();
  expect(feed.getByLabelText("Réponse à opus-dev-2")).toBeTruthy();
  expect(calls).toContainEqual({ method: "runMoments", runId: FEED_RUN });
});

test("a target of the feed opens the file in the run's worktree", async () => {
  const { onOpenFile } = renderDock();
  const feed = within(screen.getByRole("region", { name: "Fil" }));
  const user = userEvent.setup();
  await user.click(await feed.findByRole("button", { name: /^A lu 2 fichiers/ }));
  await user.click(await feed.findByRole("button", { name: "packages/daemon/src/hooks/receiver.test.ts" }));
  expect(onOpenFile.mock.calls[0]?.[0]).toMatchObject({
    projectId: "kibo",
    worktree: WORKTREE,
    path: "packages/daemon/src/hooks/receiver.test.ts",
  });
});

test("new moments arrive live, in order and without duplicates", async () => {
  page = { ...MOMENTS_PAGE, moments: MOMENTS.slice(0, 2) };
  renderDock();
  const feed = within(screen.getByRole("region", { name: "Fil" }));
  await feed.findByText("Je relis le récepteur et ses tests avant de toucher au port.");
  act(() => {
    for (const l of momentListeners) l({ type: "run.moments", runId: "other", moments: MOMENTS.slice(3, 4) });
    for (const l of momentListeners)
      l({ type: "run.moments", runId: FEED_RUN, moments: MOMENTS.slice(1, 4) });
  });
  const seqs = () =>
    Array.from(screen.getByRole("list", { name: "Fil de opus-dev-2" }).children).map((li) =>
      li.getAttribute("data-seq"),
    );
  expect(seqs()).toEqual(["1", "2", "3", "4"]);
});

test("the plan column shows the shared plan with its state and position", async () => {
  renderDock();
  const plan = within(screen.getByRole("region", { name: "Plan" }));
  expect(await plan.findByText("2/5")).toBeTruthy();
  expect(plan.getByText("ticket_progress")).toBeTruthy();
  expect(plan.getAllByRole("button").map((b) => b.getAttribute("data-status"))).toEqual(
    PLAN.map((s) => s.status),
  );
  expect(plan.queryByText("plan interne de l'agent")).toBeNull();
});

test("without a shared plan of this run, the agent's own list is shown as its internal plan", async () => {
  project = {
    ...project,
    tickets: project.tickets.map((t) => ({ ...t, agentProgress: { ...t.agentProgress, planRunId: "r1" } })),
  };
  page = {
    ...MOMENTS_PAGE,
    internalPlan: [{ id: "todo-1", title: "Lire le code", status: "doing", note: null }],
  };
  renderDock();
  const plan = within(screen.getByRole("region", { name: "Plan" }));
  expect(await plan.findByText("plan interne de l'agent")).toBeTruthy();
  expect(plan.getByText("Lire le code")).toBeTruthy();
});

test("picking a step marks its moments and scrolls the feed to the first one", async () => {
  const scrolled: string[] = [];
  const original = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this.getAttribute("data-seq") ?? "");
  };
  try {
    renderDock();
    const plan = within(screen.getByRole("region", { name: "Plan" }));
    await screen.findByText("Je relis le récepteur et ses tests avant de toucher au port.");
    await userEvent
      .setup()
      .click(await plan.findByRole("button", { name: /Corriger la validation du corps/ }));
    const feed = screen.getByRole("region", { name: "Fil" });
    await waitFor(() => expect(scrolled).toEqual(["4"]));
    const current = Array.from(feed.querySelectorAll("[data-step-current]")).map((el) =>
      el.getAttribute("data-seq"),
    );
    expect(current).toEqual(["4", "6", "7"]);
  } finally {
    Element.prototype.scrollIntoView = original;
  }
});

test("a finished run shows its report, or says it has none", async () => {
  renderDock(REPORTED_RUN);
  const feed = within(screen.getByRole("region", { name: "Fil" }));
  expect(await feed.findByText("À vérifier (2)")).toBeTruthy();
  expect(feed.getByText("1 fichier modifié non mentionné")).toBeTruthy();
});

test("a finished run without a report says so in the feed", async () => {
  renderDock(UNREPORTED_RUN);
  const feed = within(screen.getByRole("region", { name: "Fil" }));
  expect(await feed.findByText("Pas de compte rendu pour ce run")).toBeTruthy();
});

test("the handle resizes the dock by drag, arrows and double click", () => {
  renderDock(null);
  const handle = screen.getByRole("separator", { name: "Redimensionner le volet des agents" });
  const dock = () => Number.parseInt(handle.parentElement?.parentElement?.style.height ?? "", 10);
  expect(handle.getAttribute("aria-valuenow")).toBe("450");
  fireEvent.pointerDown(handle, { clientY: 500, pointerId: 1 });
  fireEvent.pointerMove(handle, { clientY: 400, pointerId: 1 });
  fireEvent.pointerUp(handle, { pointerId: 1 });
  expect(dock()).toBe(550);
  fireEvent.keyDown(handle, { key: "ArrowUp" });
  expect(handle.getAttribute("aria-valuenow")).toBe("566");
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  fireEvent.keyDown(handle, { key: "ArrowDown" });
  expect(dock()).toBe(534);
  expect(window.sessionStorage.getItem("kibo.agents.dock.height")).toBe("534");
  fireEvent.doubleClick(handle);
  expect(dock()).toBe(450);
});

test("the unfolded bar folds the dock back", async () => {
  const { onCollapse } = renderDock(null);
  await userEvent.setup().click(screen.getByRole("button", { name: "Replier les agents" }));
  expect(onCollapse).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Choisis un run pour voir son fil.")).toBeTruthy();
});
