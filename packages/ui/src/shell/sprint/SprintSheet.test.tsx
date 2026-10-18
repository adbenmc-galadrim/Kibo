import { afterEach, beforeEach, expect, mock, setSystemTime, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../../api-mock";
import { NOW } from "../feature/fixture";
import { batch, moveF5, remindQ14, sprintProject } from "./sprint-fixture";

const calls: RpcRequest[] = [];
let batches = [batch([moveF5, remindQ14])];
mock.module("../../api", () =>
  apiMock({
    client: {
      subscribe: () => () => {},
      subscribeTopic: () => () => {},
      rpc: async (req: RpcRequest) => {
        if (req.method === "getProjectAgent")
          return { session: null, run: null, batches, past: [], memoryPath: "/m" };
        if (req.method === "getAppInfo") return { today: "2026-10-16" };
        calls.push(req);
        return null;
      },
    },
  }),
);
const { SprintSheet } = await import("./SprintSheet");

const project = sprintProject();
beforeEach(() => {
  calls.length = 0;
  batches = [batch([moveF5, remindQ14])];
});

afterEach(() => setSystemTime());

function mount(sprintId = "s42") {
  const opened: string[] = [];
  const tabs: unknown[] = [];
  const view = render(
    <SprintSheet
      route={{ projectId: "emis", sprintId }}
      project={project}
      now={NOW}
      onClose={() => {}}
      onOpenTicket={(id) => opened.push(id)}
      onOpenInTab={(t) => tabs.push(t)}
    />,
  );
  return { view, opened, tabs };
}

test("the sheet times the sprint on the day of the daemon, not of the browser", async () => {
  setSystemTime(new Date(2026, 9, 14, 10));
  render(
    <SprintSheet
      route={{ projectId: "emis", sprintId: "s42" }}
      project={project}
      onClose={() => {}}
      onOpenTicket={() => {}}
      onOpenInTab={() => {}}
    />,
  );
  expect(await screen.findByText("· finit ce soir · 1 livrée sur 3")).toBeTruthy();
});

test("the sheet shows the sprint, its timing, its features and the footer", async () => {
  const { opened, tabs } = mount();
  expect(screen.getByRole("heading", { name: "S42 · Terrain hors ligne" })).toBeTruthy();
  expect(screen.getByText("en cours")).toBeTruthy();
  expect(screen.getByText("12–16 oct.")).toBeTruthy();
  expect(screen.getByText("· finit ce soir · 1 livrée sur 3")).toBeTruthy();
  const list = screen.getByRole("list", { name: "Fonctionnalités du sprint" });
  expect(
    within(list)
      .getAllByRole("listitem")
      .map((li) => li.textContent?.slice(0, 2)),
  ).toEqual(["F3", "F4", "F5"]);
  expect(screen.getAllByRole("img", { name: "Étapes de F5" })).toHaveLength(1);
  expect(
    screen.getByText(
      "Ce qui reste à la fin du sprint est reporté à la main, sur proposition de l'agent de projet.",
    ),
  ).toBeTruthy();
  await userEvent.click(within(list).getByText("Envoyer les photos d'un tronçon"));
  expect(opened).toEqual(["f5"]);
  await userEvent.click(screen.getByRole("button", { name: "Ouvrir dans un onglet" }));
  expect(tabs).toEqual([{ kind: "sprint", projectId: "emis", sprintId: "s42" }]);
});

test("the end of sprint banner applies only the sprint's action and keeps the rest of the batch", async () => {
  mount();
  await waitFor(() => expect(screen.getByText("Fin de sprint : reporter F5 en S43 ?")).toBeTruthy());
  await userEvent.click(screen.getByRole("button", { name: "Valider" }));
  expect(calls).toEqual([
    {
      method: "decideBatch",
      projectId: "emis",
      batchId: "b7",
      decision: "apply",
      actionIds: [1],
      keepRest: true,
    },
  ]);
});

test("a finished sprint says when it ended and has no banner without proposal", async () => {
  batches = [];
  mount("s41");
  expect(screen.getByText("· terminé le 9 oct. · 0 livrée sur 0")).toBeTruthy();
  expect(screen.getByText("terminé")).toBeTruthy();
  await act(async () => {});
  expect(screen.queryByRole("button", { name: "Valider" })).toBeNull();
});

test("Modifier edits the sprint and Supprimer warns how many features go back to À planifier", async () => {
  mount();
  await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
  const name = screen.getByLabelText("Nom");
  await userEvent.clear(name);
  await userEvent.type(name, "Terrain");
  await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "emis",
    command: {
      method: "updateSprint",
      sprintId: "s42",
      patch: { code: "S42", name: "Terrain", start: "2026-10-12", end: "2026-10-16" },
    },
  });
  await userEvent.click(screen.getByRole("button", { name: "Modifier" }));
  await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  expect(screen.getByText("3 fonctionnalités repassent À planifier.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Supprimer" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "emis",
    command: { method: "deleteSprint", sprintId: "s42" },
  });
});
