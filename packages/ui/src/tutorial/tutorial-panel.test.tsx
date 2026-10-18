import { beforeEach, expect, mock, test } from "bun:test";
import {
  type RpcRequest,
  type TabTarget,
  TUTORIAL_NEVER,
  TUTORIAL_STEPS,
  type TutorialState,
} from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(TUTORIAL_NEVER);
      },
    },
  }),
);

const { TutorialPanel } = await import("./TutorialPanel");

const active: TutorialState = {
  status: "active",
  completed: [],
  projectId: "demo",
  startedAt: 1,
  seenViews: [],
  seed: {
    featureIds: ["f1"],
    reviewTicketId: "s4",
    questionId: "q1",
    copyTicketId: "s5",
    overviewPageId: "po",
    planningPageId: "pp",
    kanbanPageId: "pk",
    questionsPageId: "pq",
  },
};
const at = (pageId: string): TabTarget => ({ kind: "page", projectId: "demo", pageId });
beforeEach(() => {
  calls.length = 0;
});

type Overrides = { state?: TutorialState; target?: TabTarget | null };

const show = ({ state = active, target = null }: Overrides = {}) => {
  const onOpen = mock((_t: TabTarget) => {});
  const onDeleteDemo = mock((_id: string) => {});
  const onClose = mock(() => {});
  render(
    <TutorialPanel
      state={state}
      copyKey="DEMO-5"
      activeTarget={target}
      onOpen={onOpen}
      onDeleteDemo={onDeleteDemo}
      onClose={onClose}
    />,
  );
  return { onOpen, onDeleteDemo, onClose, panel: () => within(screen.getByRole("complementary")) };
};
const step = (completed: TutorialState["completed"]): TutorialState => ({ ...active, completed });

test("five dots, the current step developed with its page", async () => {
  const { panel, onOpen } = show();
  const dots = panel().getAllByRole("listitem");
  expect(dots).toHaveLength(TUTORIAL_STEPS.length);
  expect(dots[0]?.getAttribute("aria-label")).toBe("Lire la Vue d'ensemble · en cours");
  expect(panel().getByText("0 sur 5")).toBeTruthy();
  await userEvent.setup().click(panel().getByRole("button", { name: "Aller à la page" }));
  expect(onOpen).toHaveBeenCalledWith(at("po"));
});

test("on the overview, « C'est lu » reports the overview as read and no page link is offered", async () => {
  const { panel } = show({ target: at("po") });
  expect(panel().queryByRole("button", { name: "Aller à la page" })).toBeNull();
  await userEvent.setup().click(panel().getByRole("button", { name: "C'est lu" }));
  expect(calls).toEqual([{ method: "markTutorialSeen", view: "overview" }]);
});

test("the review step asks the demo daemon to simulate the pull request", async () => {
  const { panel } = show({ state: step(["overview", "feature"]) });
  await userEvent.setup().click(panel().getByRole("button", { name: "Simuler la PR" }));
  expect(calls).toEqual([{ method: "simulateTutorialReview", projectId: "demo" }]);
});

test("the copy step copies /full-delivery and its key, then reports the copy", async () => {
  const { panel } = show({ state: step(["overview", "feature", "review", "question"]) });
  await userEvent.setup().click(panel().getByRole("button", { name: "Copier /full-delivery DEMO-5" }));
  await waitFor(() => expect(calls).toEqual([{ method: "markTutorialSeen", view: "copy" }]));
  expect(await navigator.clipboard.readText()).toBe("/full-delivery DEMO-5");
});

test("skip, pause and stop send their RPC; no step launches an agent", async () => {
  const { panel } = show({ state: step(["overview"]) });
  const user = userEvent.setup();
  await user.click(panel().getByRole("button", { name: "Passer cette étape" }));
  await user.click(panel().getByRole("button", { name: "Mettre en pause" }));
  await user.click(panel().getByRole("button", { name: "Arrêter le didacticiel" }));
  expect(calls).toEqual([
    { method: "skipTutorialStep", step: "feature" },
    { method: "pauseTutorial" },
    { method: "skipTutorial" },
  ]);
  expect(screen.queryByText(/agent/i)).toBeNull();
});

test("the card collapses to its header and expands back", async () => {
  const { panel } = show();
  const user = userEvent.setup();
  await user.click(panel().getByRole("button", { name: "Replier le didacticiel" }));
  expect(panel().queryByRole("button", { name: "Aller à la page" })).toBeNull();
  await user.click(panel().getByRole("button", { name: "Déplier le didacticiel" }));
  expect(panel().getByRole("button", { name: "Aller à la page" })).toBeTruthy();
});

test("a finished tour congratulates, offers to delete the demo and closes", async () => {
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
