import { beforeEach, expect, mock, test } from "bun:test";
import {
  type Page,
  type RpcRequest,
  type TabTarget,
  TUTORIAL_NEVER,
  TUTORIAL_STEPS,
  type TutorialState,
} from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return Promise.resolve(TUTORIAL_NEVER);
    },
  },
}));

const { TutorialPanel } = await import("./TutorialPanel");

const page = (id: string, title: string, kind: Page["kind"]): Page => ({ id, title, kind, parentId: null });
const pages = [
  page("pd", "Tableau de bord", "dashboard"),
  page("pk", "Kanban", "view"),
  page("pg", "Graphe", "view"),
  page("pn", "Notes", "view"),
];
const active: TutorialState = {
  status: "active",
  completed: ["kanban"],
  projectId: "demo",
  startedAt: 1,
  seenViews: [],
  seed: {
    ticketIds: [],
    linkKeys: [],
    layouts: {},
    noteHash: "h",
    dashboardPageId: "pd",
    graphPageId: "pg",
  },
};

beforeEach(() => {
  calls.length = 0;
});

type Overrides = { state?: TutorialState; target?: TabTarget | null };

const show = ({ state = active, target = null }: Overrides = {}) => {
  const onOpen = mock((_t: TabTarget) => {});
  const onDeleteDemo = mock((_id: string) => {});
  const onClose = mock(() => {});
  const props = { state, pages, onOpen, onDeleteDemo, onClose };
  const view = render(<TutorialPanel {...props} activeTarget={target} />);
  const rerender = (next: TabTarget | null, nextState: TutorialState = state) =>
    view.rerender(<TutorialPanel {...props} state={nextState} activeTarget={next} />);
  return { onOpen, onDeleteDemo, onClose, rerender, panel: () => within(screen.getByRole("complementary")) };
};

test("the floating card shows six dots and develops the current step", async () => {
  const { panel, onOpen } = show();
  expect(screen.getByRole("complementary", { name: "Didacticiel" })).toBeTruthy();
  const dots = panel().getAllByRole("listitem");
  expect(dots).toHaveLength(TUTORIAL_STEPS.length);
  expect(dots[0]?.getAttribute("aria-label")).toBe("Créer un ticket et le déplacer · fait");
  expect(dots[1]?.getAttribute("aria-label")).toBe("Lier deux tickets · en cours");
  expect(panel().getByText("1 sur 6")).toBeTruthy();
  expect(panel().getByText("Lier deux tickets", { selector: "h3" })).toBeTruthy();
  expect(panel().getByText(/page Graphe/)).toBeTruthy();
  await userEvent.setup().click(panel().getByRole("button", { name: "Aller à la page" }));
  expect(onOpen).toHaveBeenCalledWith({ kind: "page", projectId: "demo", pageId: "pg" });
});

test("skip, pause and stop send their RPC", async () => {
  const { panel } = show();
  const user = userEvent.setup();
  await user.click(panel().getByRole("button", { name: "Passer cette étape" }));
  await user.click(panel().getByRole("button", { name: "Mettre en pause" }));
  await user.click(panel().getByRole("button", { name: "Arrêter le didacticiel" }));
  expect(calls).toEqual([
    { method: "skipTutorialStep", step: "links" },
    { method: "pauseTutorial" },
    { method: "skipTutorial" },
  ]);
});

test("the card collapses to its header and expands back", async () => {
  const { panel } = show();
  const user = userEvent.setup();
  await user.click(panel().getByRole("button", { name: "Replier le didacticiel" }));
  expect(panel().queryByRole("button", { name: "Aller à la page" })).toBeNull();
  await user.click(panel().getByRole("button", { name: "Déplier le didacticiel" }));
  expect(panel().getByRole("button", { name: "Aller à la page" })).toBeTruthy();
});

test("opening the demo graph page marks the graph seen once", () => {
  const graph: TabTarget = { kind: "page", projectId: "demo", pageId: "pg" };
  const { rerender } = show({ target: { kind: "page", projectId: "demo", pageId: "pk" } });
  expect(calls).toEqual([]);
  rerender(graph);
  rerender({ kind: "project", projectId: "demo" });
  rerender(graph);
  expect(calls).toEqual([{ method: "markTutorialSeen", view: "graph" }]);
});

test("a graph already seen or another project's graph sends nothing", () => {
  show({
    state: { ...active, seenViews: ["graph"] },
    target: { kind: "page", projectId: "demo", pageId: "pg" },
  });
  show({ target: { kind: "page", projectId: "other", pageId: "pg" } });
  expect(calls).toEqual([]);
});

test("a finished tour congratulates and offers to delete the demo project", async () => {
  const done: TutorialState = { ...active, status: "done", completed: [...TUTORIAL_STEPS] };
  const { panel, onDeleteDemo, onClose } = show({ state: done });
  expect(panel().getByText("Bravo, tu as fait le tour de Kibo")).toBeTruthy();
  expect(panel().queryByRole("button", { name: "Passer cette étape" })).toBeNull();
  const user = userEvent.setup();
  await user.click(panel().getByRole("button", { name: "Supprimer le projet de démo" }));
  expect(onDeleteDemo).toHaveBeenCalledWith("demo");
  await user.click(panel().getByRole("button", { name: "Fermer" }));
  expect(onClose).toHaveBeenCalled();
});
