import { beforeEach, expect, mock, test } from "bun:test";
import { defaultFormatOf, KiboError, layoutFor, type RpcRequest } from "@kibo/schema";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let add: () => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return add();
      },
      subscribe: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
    },
  }),
);

const { AddComponentDialog } = await import("./AddComponentDialog");
const { findBuiltin } = await import("../registry");
const kanbanManifest = () => {
  const found = findBuiltin("kanban");
  if (!found) throw new Error("kanban is a built-in");
  return found.manifest;
};

const page = { id: "pg1", title: "Tableau de bord", kind: "dashboard", parentId: null } as const;
const search = () => screen.getByPlaceholderText("Rechercher un composant…");

beforeEach(() => {
  calls.length = 0;
  add = () => Promise.resolve(null);
});

test("screen 3: built-ins only, search, preview and display", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  expect(await screen.findByRole("radio", { name: "Kanban" })).toBeTruthy();
  expect(screen.getByText("Intégrés")).toBeTruthy();
  expect(screen.queryByText("Mes composants")).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(screen.getByText("Widget dans la grille")).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Synchronisée · GitHub Issues" })).toBeNull();
  expect(
    screen.getByText(
      "Intégré · confiance totale · lit : ticket, status, runs CI, question, sprint · écrit : ticket",
    ),
  ).toBeTruthy();
  await user.type(search(), "graphe");
  expect(screen.queryByRole("radio", { name: "Kanban" })).toBeNull();
  expect(screen.getByRole("radio", { name: "Graphe de dépendances" })).toBeTruthy();
  await user.clear(search());
  await user.type(search(), "zzz");
  expect(screen.getByText("Aucun composant ne correspond.")).toBeTruthy();
});

test("only the six built-ins are on offer: no notes, tickets, MCP source or 3D viewer", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const list = within(await screen.findByRole("region", { name: "Composants disponibles" }));
  expect(list.getAllByRole("radio")).toHaveLength(6);
  for (const name of [
    "Vue d'ensemble",
    "Planning",
    "Kanban",
    "Graphe de dépendances",
    "Questions",
    "Maquette",
  ])
    expect(list.getByRole("radio", { name })).toBeTruthy();
  expect(list.queryByRole("radio", { name: "Tickets" })).toBeNull();
  expect(list.queryByRole("radio", { name: "Notes" })).toBeNull();
  expect(list.queryByRole("radio", { name: "Source MCP" })).toBeNull();
  expect(list.queryByRole("radio", { name: "Visionneuse 3D" })).toBeNull();
});

test("header and footer stay outside the two scrolling panes", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  const list = await screen.findByRole("region", { name: "Composants disponibles" });
  await within(list).findByRole("radio", { name: "Planning" });
  const details = screen.getByRole("region", { name: "Description du composant" });
  const dialog = screen.getByRole("dialog", { name: "Ajouter un composant" });
  expect(dialog.className).toContain("overflow-hidden");
  expect(dialog.className).not.toContain("overflow-y-auto");
  const fixed = [
    search(),
    screen.getByRole("button", { name: "Annuler" }),
    screen.getByRole("button", { name: "Ajouter à la page" }),
  ];
  for (const el of fixed) {
    expect(list.contains(el)).toBe(false);
    expect(details.contains(el)).toBe(false);
  }
  const scroller = within(list).getByRole("radiogroup").closest(".overflow-y-auto");
  expect(scroller && list.contains(scroller)).toBe(true);
  expect(within(list).queryByRole("button", { name: "Créer un composant (code ou IA)" })).toBeNull();
  expect(details.className).toContain("overflow-y-auto");
  expect(details.textContent).toBe("Choisis un composant pour voir ce qu'il lit et modifie.");
  await userEvent.setup().click(within(list).getByRole("radio", { name: "Planning" }));
  expect(within(details).getByText("Planning")).toBeTruthy();
});

test("a built-in is added at the size of its default format in the next free slot", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(
    <AddComponentDialog
      projectId="p1"
      page={page}
      taken={[{ x: 0, y: 0, w: 6, h: 6 }]}
      open
      onOpenChange={onOpenChange}
    />,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect(calls.at(-1)).toEqual({
    method: "command",
    projectId: "p1",
    command: {
      method: "addInstance",
      pageId: "pg1",
      component: "kanban@1.0.0",
      layout: layoutFor(defaultFormatOf(kanbanManifest()), 6, 0),
    },
  });
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("a failure to add is shown, never swallowed", async () => {
  const logged = mock((_: unknown) => {});
  const original = console.error;
  console.error = logged;
  try {
    add = () => Promise.reject(new KiboError("INTERNAL", "boom"));
    render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole("radio", { name: "Kanban" }));
    await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ajouter le composant.");
    expect(logged).toHaveBeenCalledTimes(1);
  } finally {
    console.error = original;
  }
});
