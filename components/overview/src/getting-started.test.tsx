import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";
import { NOW, TODAY } from "./test-seed";

type Run = (cmd: ProjectCommand) => unknown;

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => {
  setSystemTime();
  cleanup();
});

const sprints = (run: Run) => {
  run({ method: "createSprint", code: "S1", name: "Sprint 1", start: "2026-10-19", end: "2026-10-23" });
  run({ method: "createSprint", code: "S2", name: "Sprint 2", start: "2026-10-26", end: "2026-10-30" });
};
const withFeature = (run: Run) => {
  sprints(run);
  const root = run({ method: "createTicket", title: "Socle", parentId: null }) as Ticket;
  run({ method: "createTicket", title: "Connexion", parentId: root.id });
};

function setup(opts: MockSdkOptions) {
  const m = createMockSdk(manifest, { today: TODAY, client: "Emis SA", ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}
const start = () => screen.findByRole("region", { name: "Pour commencer" });
const row = (card: HTMLElement, name: string) => {
  const found = within(card)
    .getAllByRole("listitem")
    .find((li) => li.textContent?.includes(name));
  if (!found) throw new Error(name);
  return found;
};

test("a new project lists two steps to start, with its sprints beside them", async () => {
  const m = setup({ seed: sprints });
  const card = await start();
  expect(within(card).getByText("0/2")).toBeTruthy();
  expect(within(card).getByText("deux étapes pour suivre le projet")).toBeTruthy();
  await userEvent.click(
    within(row(card, "Relier le dépôt")).getByRole("button", { name: "Choisir le dossier" }),
  );
  expect(m.projectEdits).toEqual([{ field: "folder" }]);
  expect(row(card, "Relier le dépôt").dataset.done).toBe("false");
  expect(row(card, "Créer une fonctionnalité").dataset.done).toBe("false");
  expect(within(card).getAllByRole("listitem").length).toBe(2);
  expect(within(card).queryByRole("button", { name: "Copier" })).toBeNull();
  await userEvent.click(
    within(row(card, "Créer une fonctionnalité")).getByRole("button", { name: "Nouvelle fonctionnalité" }),
  );
  expect(m.viewRequests).toEqual([
    { componentId: "planning", question: null, intent: { kind: "newFeature" } },
  ]);
  const list = screen.getByRole("region", { name: "Sprints" });
  expect(
    within(list)
      .getAllByRole("listitem")
      .map((li) => li.textContent),
  ).toEqual(["S1Sprint 119–23 oct.", "S2Sprint 226–30 oct."]);
  expect(screen.queryByRole("region", { name: "Échéances" })).toBeNull();
  expect(screen.getByText("client Emis SA")).toBeTruthy();
});

test("a feature checks its step and the copy gives the first step with a toast", async () => {
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void copied.push(text) },
  });
  const m = setup({ seed: withFeature });
  const card = await start();
  await waitFor(() => expect(row(card, "Créer une fonctionnalité").dataset.done).toBe("true"));
  expect(within(card).getByText("1/3")).toBeTruthy();
  const step = m.snapshot().tickets.find((t) => t.title === "Connexion");
  const copyRow = row(card, "Copier");
  expect(within(copyRow).getByText(`/full-delivery ${step?.key}`)).toBeTruthy();
  await userEvent.click(within(copyRow).getByRole("button", { name: "Copier" }));
  expect(copied).toEqual([`/full-delivery ${step?.key}`]);
  expect(m.toasts).toEqual(["Copié"]);
  await waitFor(() => expect(row(card, "Copier").dataset.done).toBe("true"));
});

test("a linked folder checks the first step", async () => {
  setup({ seed: sprints, folder: "/emis" });
  const card = await start();
  await waitFor(() => expect(row(card, "Relier le dépôt").dataset.done).toBe("true"));
});

test("with a feature and a folder the list is gone", async () => {
  setup({ seed: withFeature, folder: "/emis" });
  await screen.findByRole("region", { name: "Indicateurs du projet" });
  await screen.findByRole("region", { name: "Échéances" });
  expect(screen.queryByRole("region", { name: "Pour commencer" })).toBeNull();
});
