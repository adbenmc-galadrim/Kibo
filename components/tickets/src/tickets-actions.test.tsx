import { expect, test } from "bun:test";
import type { ProjectCommand, ProjectSnapshot, Sprint, Ticket, TicketRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = run({ method: "createTicket", title: "Arbre des pages" }) as Ticket;
  run({
    method: "createTicket",
    title: "Déplacement",
    parentId: parent.id,
    statusId: "in_progress",
    assignee: { kind: "human", ref: "adam" },
  });
  run({ method: "createTicket", title: "Renommage", parentId: parent.id });
  const other = run({ method: "createTicket", title: "Sync" }) as Ticket;
  run({ method: "setStatus", ticketId: other.id, statusId: "blocked", reason: "Attente client" });
  return parent;
};

const plannedSeed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = seed(run);
  const sprint = run({
    method: "createSprint",
    code: "S42",
    name: "S42",
    start: "2026-10-12",
    end: "2026-10-16",
  });
  run({ method: "setTicketSprint", ticketId: parent.id, sprintId: (sprint as Sprint).id });
};

const runs = (s: ProjectSnapshot): TicketRun[] => [
  {
    ticketId: s.tickets.find((t) => t.title === "Sync")?.id ?? "",
    runId: "r1",
    label: "opus-dev-2",
    state: "waiting_input",
    position: null,
  },
];

runConformance({ manifest, Component }, seed, { runs });

type Mock = ReturnType<typeof createMockSdk>;
const mount = (m: Mock) =>
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
const byKey = (m: Mock, key: string) => m.snapshot().tickets.find((t) => t.key === key);
const pickStatus = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole("menuitem", { name: "Statut" }));
  await user.keyboard("{ArrowRight}");
  for (let i = 0; i < 8 && document.activeElement?.textContent !== name; i++)
    await user.keyboard("{ArrowDown}");
  await user.keyboard("{Enter}");
};

test("steps are rows, their feature is a chip; a root without step waits in Hors fonctionnalité, open", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  expect(await screen.findByText("tous les sprints · 2 tickets dans 1 fonctionnalité")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Arbre des pages" })).toBeNull();
  expect(
    screen
      .getAllByRole("button", { name: "Ouvrir la fonctionnalité F1 · Arbre des pages" })
      .filter((chip) => chip.closest("[data-cell=feature]")),
  ).toHaveLength(2);
  fireEvent.click(screen.getByRole("button", { name: "Déplacement" }));
  expect(m.opened).toEqual([byKey(m, "KIB-2")?.id ?? ""]);
  fireEvent.click(screen.getByRole("button", { name: fr.newSubTicket("KIB-2") }));
  expect(m.newTicketRequests[0]?.parentId).toBe(byKey(m, "KIB-2")?.id);
  expect(screen.getByRole("button", { name: "Sync" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Replier Hors fonctionnalité" }));
  expect(screen.queryByRole("button", { name: "Sync" })).toBeNull();
});

test("the row menu changes the status; Bloqué asks for a reason", async () => {
  const m = createMockSdk(manifest, { seed, agentExecution: "shown" });
  mount(m);
  const user = userEvent.setup();
  await user.pointer({
    keys: "[MouseRight]",
    target: await screen.findByRole("button", { name: "Déplacement" }),
  });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir",
    "Livrer",
    "Statut",
    "Nouveau sous-ticket",
    "Déplacer à la racine",
    "Supprimer…",
  ]);
  await pickStatus(user, "À faire");
  await waitFor(() => expect(byKey(m, "KIB-2")?.statusId).toBe("todo"));
  await user.click(screen.getByRole("button", { name: "Actions KIB-2" }));
  await pickStatus(user, "Bloqué…");
  const dialog = await screen.findByRole("dialog", { name: "Bloquer KIB-2" });
  await user.type(within(dialog).getByLabelText("Motif"), "Attente client");
  await user.click(within(dialog).getByRole("button", { name: "Bloquer" }));
  await waitFor(() =>
    expect(byKey(m, "KIB-2")).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" }),
  );
});

test("move to root and delete go through the row menu", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer à la racine" }));
  await waitFor(() => expect(byKey(m, "KIB-3")?.parentId).toBeNull());
  await user.click(screen.getByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer KIB-2 ?" });
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(byKey(m, "KIB-2")).toBeUndefined());
});

test("a refused command is shown as an alert", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={{ ...m.sdk, run: () => Promise.reject(new Error("daemon unreachable")) }}>
      <Component />
    </SdkProvider>,
  );
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await pickStatus(user, "Terminé");
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de changer le statut de KIB-3.");
});

test("a read-only project shows no ⋯ button, no new ticket and a one-entry menu", async () => {
  const m = createMockSdk(manifest, { seed, shared: true });
  m.setAccess("read-only");
  mount(m);
  const user = userEvent.setup();
  await screen.findByText("Déplacement");
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions / })).toBeNull());
  expect(screen.queryByRole("button", { name: "Nouveau ticket" })).toBeNull();
  await user.pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Déplacement" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir"]);
});

test("the empty state offers a new ticket; a loading snapshot shows a skeleton", async () => {
  const m = createMockSdk(manifest);
  const { unmount } = mount(m);
  const empty = (await screen.findByText("Aucun ticket pour l'instant.")).closest("div");
  fireEvent.click(within(empty ?? document.body).getByRole("button", { name: "Nouveau ticket" }));
  expect(m.newTicketRequests).toHaveLength(1);
  expect(screen.queryByRole("tablist")).toBeNull();
  unmount();
  render(
    <SdkProvider sdk={{ ...m.sdk, list: () => new Promise(() => {}) }}>
      <Component />
    </SdkProvider>,
  );
  await waitFor(() => expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(5));
});

test("filter mine keeps my steps and says so; provisional keys stay italic", async () => {
  const m = createMockSdk(manifest, { seed, config: { filter: "mine" }, viewer: "adam", surface: "view" });
  mount(m);
  expect(await screen.findByRole("heading", { name: "Mes tickets" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Déplacement" })).toBeTruthy();
  expect(screen.queryByText("Renommage")).toBeNull();
  const shared = createMockSdk(manifest, {
    shared: true,
    seed: (run) => {
      const root = run({ method: "createTicket", title: "Schéma" }) as Ticket;
      run({ method: "createTicket", title: "Types", parentId: root.id });
    },
  });
  mount(shared);
  expect((await screen.findByText("KIB-…")).className).toContain("italic");
});

test("shared selection: the selected step stays sharp, the chip clears it", async () => {
  const m = createMockSdk(manifest, { seed });
  m.setSelection({ kind: "ticket", ids: [byKey(m, "KIB-2")?.id ?? ""] });
  mount(m);
  const row = async (title: string) =>
    (await screen.findByRole("button", { name: title })).closest<HTMLElement>("[data-selected]");
  const chosen = await row("Déplacement");
  const other = await row("Renommage");
  expect(chosen?.getAttribute("data-selected")).toBe("true");
  expect(other?.className).toContain("opacity-50");
  fireEvent.click(screen.getByRole("button", { name: "Effacer la sélection" }));
  expect(m.selections.at(-1)).toBeNull();
  await waitFor(() => expect(other?.className).not.toContain("opacity-50"));
});

test("the open questions of a row sit in its hover card, never a zero", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  await screen.findByText("Déplacement");
  expect(screen.queryByText(/questions?$/)).toBeNull();
  act(() => {
    m.run({
      method: "createQuestion",
      ticketId: byKey(m, "KIB-2")?.id ?? "",
      title: "Port du démon ?",
      createdBy: { kind: "agent", ref: "opus-dev" },
    });
  });
  await waitFor(() => expect(byKey(m, "KIB-2")?.openQuestions).toBe(1));
  expect(screen.queryByRole("button", { name: "1 question, ouvrir" })).toBeNull();
  fireEvent.focus(screen.getByRole("button", { name: "Déplacement" }));
  fireEvent.click(await screen.findByRole("button", { name: "1 question, ouvrir" }));
  const first = m.snapshot().questions[0]?.id ?? "";
  expect(m.viewRequests).toEqual([{ componentId: "questions", question: first }]);
});

test("Livrer on a step asks the SDK for a run; without a delivery agent there is no Livrer", async () => {
  const planned = { seed: plannedSeed, today: "2026-10-14" };
  const m = createMockSdk(manifest, { ...planned, agentExecution: "shown" });
  const { unmount } = mount(m);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await user.click(await screen.findByRole("menuitem", { name: "Livrer" }));
  await waitFor(() => expect(m.runDeliveries).toEqual([byKey(m, "KIB-3")?.id ?? ""]));
  unmount();
  mount(createMockSdk(manifest, { ...planned, deliveryAgent: null, agentExecution: "shown" }));
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await screen.findByRole("menuitem", { name: "Ouvrir" });
  expect(screen.queryByRole("menuitem", { name: /^Livrer/ })).toBeNull();
});

test("with agent execution hidden, the row menu copies the full-delivery command instead of Livrer", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-3" }));
  await user.click(await screen.findByRole("menuitem", { name: "Copier /full-delivery KIB-3" }));
  expect(screen.queryByRole("menuitem", { name: "Livrer" })).toBeNull();
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("/full-delivery KIB-3"));
  await waitFor(() => expect(m.toasts).toEqual(["Copié"]));
  expect(m.runDeliveries).toEqual([]);
});
