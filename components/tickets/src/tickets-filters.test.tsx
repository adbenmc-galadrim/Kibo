import { expect, test } from "bun:test";
import type { ProjectCommand, Ticket } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const core = run({ method: "createTicket", title: "Noyau de données" }) as Ticket;
  run({
    method: "createTicket",
    title: "Schéma Loro des tickets",
    parentId: core.id,
    labels: ["area:api", "phase:p1", "urgent"],
  });
  run({
    method: "createTicket",
    title: "Kanban : glisser entre colonnes",
    parentId: core.id,
    statusId: "in_progress",
    assignee: { kind: "agent", ref: "opus-dev" },
    labels: ["phase:p1"],
  });
  const blocker = run({
    method: "createTicket",
    title: "Types Zod",
    parentId: core.id,
    assignee: { kind: "human", ref: "adam" },
  }) as Ticket;
  const waiting = run({ method: "createTicket", title: "Validation", parentId: core.id }) as Ticket;
  run({ method: "addLink", from: blocker.id, to: waiting.id, type: "blocks" });
};

const setup = (surface: "view" | "widget" = "view") => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", surface, agentExecution: "shown" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};
const titles = () => Array.from(document.querySelectorAll("[data-row-title]"), (b) => b.textContent);
const ALL = ["Schéma Loro des tickets", "Kanban : glisser entre colonnes", "Types Zod", "Validation"];

test("/ opens the search in place of the sprint tabs; typing narrows, accents ignored; Escape restores", async () => {
  setup();
  await screen.findByText("Types Zod");
  const user = userEvent.setup();
  expect(screen.queryByRole("searchbox")).toBeNull();
  await user.keyboard("/");
  const search = await screen.findByRole("searchbox", { name: "Rechercher (clé ou titre)" });
  expect(screen.queryByRole("tablist")).toBeNull();
  await user.type(search, "schema");
  expect(titles()).toEqual(["Schéma Loro des tickets"]);
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("searchbox")).toBeNull();
  expect(screen.getByRole("tablist", { name: "Sprint affiché" })).toBeTruthy();
  expect(titles()).toEqual(ALL);
});

test("⌘F or Ctrl+F opens the search too; a widget listens only when focused", async () => {
  setup();
  await screen.findByText("Types Zod");
  fireEvent.keyDown(window, { key: "f", metaKey: true });
  expect(await screen.findByRole("searchbox")).toBeTruthy();
});

test("in a widget, the keys open the search only from inside it", async () => {
  setup("widget");
  await screen.findByText("Types Zod");
  fireEvent.keyDown(window, { key: "/" });
  expect(screen.queryByRole("searchbox")).toBeNull();
  fireEvent.keyDown(screen.getByRole("region", { name: "Tickets" }), { key: "f", ctrlKey: true });
  expect(await screen.findByRole("searchbox")).toBeTruthy();
});

test("the Ouverts menu holds Démarrables, the statuses and the assignee; Effacer les filtres restores", async () => {
  setup();
  await screen.findByText("Types Zod");
  const user = userEvent.setup();
  const open = screen.getByRole("button", { name: "Ouverts" });
  await user.click(open);
  await user.click(await screen.findByRole("menuitemcheckbox", { name: "Démarrables" }));
  expect(titles()).toEqual(["Schéma Loro des tickets", "Types Zod"]);
  await user.click(screen.getByRole("menuitemcheckbox", { name: "Démarrables" }));
  await user.click(screen.getByRole("menuitemcheckbox", { name: "En cours" }));
  expect(titles()).toEqual(["Kanban : glisser entre colonnes"]);
  await user.click(screen.getByRole("menuitemcheckbox", { name: "En cours" }));
  await user.click(screen.getByRole("menuitemradio", { name: "Agents" }));
  expect(titles()).toEqual(["Kanban : glisser entre colonnes"]);
  await user.click(screen.getByRole("menuitemradio", { name: "Moi" }));
  expect(titles()).toEqual(["Types Zod"]);
  expect(open.getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("menuitem", { name: "Effacer les filtres" }));
  expect(titles()).toEqual(ALL);
  expect(open.getAttribute("aria-pressed")).toBe("false");
});

test("the Fonctionnalité menu groups the project's labels; checking one narrows the rows", async () => {
  setup();
  await screen.findByText("Types Zod");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Fonctionnalité" }));
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitemcheckbox")
      .map((i) => i.textContent),
  ).toEqual(["urgent", "area:api", "phase:p1"]);
  expect(within(menu).getByText("Libres")).toBeTruthy();
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "phase:p1" }));
  await user.keyboard("{Escape}");
  expect(titles()).toEqual(["Schéma Loro des tickets", "Kanban : glisser entre colonnes"]);
  expect(screen.getByRole("button", { name: /^Fonctionnalité/ }).getAttribute("aria-pressed")).toBe("true");
});

test("a project without labels says so in the Fonctionnalité menu", async () => {
  const m = createMockSdk(manifest, {
    seed: (run) => {
      const root = run({ method: "createTicket", title: "Racine" }) as Ticket;
      run({ method: "createTicket", title: "Étape", parentId: root.id });
    },
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("Étape");
  await userEvent.setup().click(screen.getByRole("button", { name: "Fonctionnalité" }));
  const none = await screen.findByRole("menuitem", { name: "Aucune étiquette dans ce projet" });
  expect(none.getAttribute("aria-disabled")).toBe("true");
});
