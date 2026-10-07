import { expect, test } from "bun:test";
import type { ProjectCommand, ProjectSnapshot, Ticket, TicketRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { seedDemo } from "@kibo/sdk/fixtures";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";
import { COLUMNS, WIDE_CELL, WIDE_TEXT } from "./TicketRow";

const seed = (run: (cmd: ProjectCommand) => unknown) => {
  const parent = run({
    method: "createTicket",
    title: "Arbre des pages",
    assignee: { kind: "human", ref: "adam" },
  }) as Ticket;
  const child = run({ method: "createTicket", title: "Déplacement", parentId: parent.id }) as Ticket;
  run({ method: "setStatus", ticketId: child.id, statusId: "done" });
  const other = run({
    method: "createTicket",
    title: "Sync",
    assignee: { kind: "agent", ref: "opus-dev" },
  }) as Ticket;
  run({ method: "setStatus", ticketId: other.id, statusId: "blocked", reason: "Attente client" });
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

test("shows keys, progress, blocked reason and opens a ticket", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("KIB-1")).toBeTruthy();
  expect(screen.getByText("1/1")).toBeTruthy();
  expect(screen.getByText("Attente client")).toBeTruthy();
  const headers = screen.getByText("Sous-tickets").parentElement ?? document.body;
  for (const header of ["Ticket", "Statut", "Assigné", "Sous-tickets"])
    expect(within(headers).getByText(header)).toBeTruthy();
  expect(screen.getByText("Terminé")).toBeTruthy();
  expect(screen.getByText("Bloqué")).toBeTruthy();
  expect(screen.getAllByText("À faire")).toHaveLength(1);
  expect(screen.getByText("adam")).toBeTruthy();
  expect(screen.getByText("opus-dev")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Sync/ }));
  expect(m.opened).toHaveLength(1);
  fireEvent.click(screen.getByRole("button", { name: fr.newSubTicket("KIB-1") }));
  expect(m.newTicketRequests[0]?.parentId).toBe(m.snapshot().tickets[0]?.id);
});

test("an agent assignee shows the state of its run", async () => {
  const m = createMockSdk(manifest, { seed });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("opus-dev")).toBeTruthy();
  act(() => m.setRuns(runs(m.snapshot())));
  const badge = (await screen.findByText("· Attend")).closest("[data-slot=badge]");
  expect(badge?.textContent).toBe("opus-dev-2· Attend");
  expect(badge?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
});

const issueRef = {
  kind: "github_issue" as const,
  bindingId: "b1",
  repo: "adam/kibo",
  number: 1,
  nodeId: "I_1",
  url: "https://github.com/adam/kibo/issues/1",
};
const syncedSeed = (run: (cmd: ProjectCommand) => unknown) => {
  const a = run({ method: "importExternalTicket", title: "Issue synchronisée", ref: issueRef }) as Ticket;
  run({ method: "createTicket", title: "Sous-tâche locale", parentId: a.id });
  run({ method: "createTicket", title: "Ticket local" });
};

test("a synced tree shows only the binding's tickets and their sub-tickets", async () => {
  const m = createMockSdk(manifest, { seed: syncedSeed, config: { source: { bindingId: "b1" } } });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("Issue synchronisée")).toBeTruthy();
  expect(screen.getByText("Sous-tâche locale")).toBeTruthy();
  expect(screen.queryByText("Ticket local")).toBeNull();
});

test("filter mine shows only my tickets with a count", async () => {
  const m = createMockSdk(manifest, { seed, config: { filter: "mine" }, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("Mes tickets · 1 sur 3")).toBeTruthy();
  expect(screen.getByText("KIB-1")).toBeTruthy();
  expect(screen.queryByText("KIB-3")).toBeNull();
});

test("the tree shows provisional keys and member names", async () => {
  const m = createMockSdk(manifest, {
    shared: true,
    members: [{ userId: "u-lea", name: "Léa", role: "editor" }],
    seed: (run) =>
      run({ method: "createTicket", title: "Schéma", assignee: { kind: "human", ref: "u-lea" } }),
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect((await screen.findByText("KIB-…")).className).toContain("italic");
  expect(await screen.findByText("Léa")).toBeTruthy();
});

const mount = (m: ReturnType<typeof createMockSdk>) =>
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
const byKey = (m: ReturnType<typeof createMockSdk>, key: string) =>
  m.snapshot().tickets.find((t) => t.key === key);
const pickStatus = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  await user.click(await screen.findByRole("menuitem", { name: "Statut" }));
  await user.keyboard("{ArrowRight}");
  for (let i = 0; i < 8 && document.activeElement?.textContent !== name; i++)
    await user.keyboard("{ArrowDown}");
  await user.keyboard("{Enter}");
};

test("the row menu changes the status; Bloqué asks for a reason", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.pointer({
    keys: "[MouseRight]",
    target: await screen.findByRole("button", { name: /Arbre des pages/ }),
  });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir",
    "Statut",
    "Nouveau sous-ticket",
    "Déplacer à la racine",
    "Supprimer…",
  ]);
  await pickStatus(user, "Terminé");
  await waitFor(() => expect(byKey(m, "KIB-1")?.statusId).toBe("done"));
  await user.click(screen.getByRole("button", { name: "Actions KIB-1" }));
  await pickStatus(user, "Bloqué…");
  const dialog = await screen.findByRole("dialog", { name: "Bloquer KIB-1" });
  await user.type(within(dialog).getByLabelText("Motif"), "Attente client");
  await user.click(within(dialog).getByRole("button", { name: "Bloquer" }));
  await waitFor(() =>
    expect(byKey(m, "KIB-1")).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" }),
  );
});

test("new sub-ticket asks the host, move to root reparents, delete asks then removes the subtree", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Nouveau sous-ticket" }));
  expect(m.newTicketRequests.at(-1)?.parentId).toBe(byKey(m, "KIB-2")?.id);
  await user.click(screen.getByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer à la racine" }));
  await waitFor(() => expect(byKey(m, "KIB-2")?.parentId).toBeNull());
  await user.click(screen.getByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer KIB-1 ?" });
  expect(confirm.textContent).toContain("Ses liens seront supprimés aussi. Cette action est irréversible.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(byKey(m, "KIB-1")).toBeUndefined());
  expect(byKey(m, "KIB-2")).toBeDefined();
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

test("a read-only project shows no ⋯ button and a one-entry menu", async () => {
  const m = createMockSdk(manifest, { seed, shared: true });
  m.setAccess("read-only");
  mount(m);
  const user = userEvent.setup();
  await screen.findByText("Arbre des pages");
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions / })).toBeNull());
  await user.pointer({
    keys: "[MouseRight]",
    target: screen.getByRole("button", { name: /Arbre des pages/ }),
  });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir"]);
});

test("screen 125: search and filters narrow the tree, drag is disabled meanwhile, clearing restores", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  mount(m);
  const user = userEvent.setup();
  await screen.findByText("Arbre des pages");
  expect(document.querySelectorAll("[aria-roledescription=draggable]")).toHaveLength(3);
  await user.type(screen.getByRole("searchbox", { name: "Rechercher (clé ou titre)" }), "deplacement");
  expect(screen.getByText("Déplacement")).toBeTruthy();
  expect(screen.getByText("Arbre des pages")).toBeTruthy();
  expect(screen.queryByText("Sync")).toBeNull();
  const context = screen.getByText("Arbre des pages").closest("[data-context]");
  expect(context?.getAttribute("data-context")).toBe("true");
  expect(context?.classList.contains("text-muted-foreground")).toBe(true);
  expect(screen.getByText("Déplacement").closest("[data-context]")).toBeNull();
  expect(document.querySelectorAll("[aria-roledescription=draggable]")).toHaveLength(0);
  await user.click(screen.getByRole("button", { name: "Effacer" }));
  expect(await screen.findByText("Sync")).toBeTruthy();
  await user.click(screen.getByRole("radio", { name: "Agents" }));
  expect(screen.getByText("Sync")).toBeTruthy();
  expect(screen.queryByText("Arbre des pages")).toBeNull();
  await user.click(screen.getByRole("radio", { name: "Tous" }));
  await user.click(screen.getByRole("button", { name: "Statut" }));
  await user.click(await screen.findByRole("menuitemcheckbox", { name: "Terminé" }));
  await user.keyboard("{Escape}");
  expect(screen.getByText("Déplacement")).toBeTruthy();
  expect(screen.queryByText("Sync")).toBeNull();
  await user.type(screen.getByRole("searchbox", { name: "Rechercher (clé ou titre)" }), "introuvable");
  const none = screen.getByText("Aucun ticket ne correspond.").closest("div");
  await user.click(within(none ?? document.body).getByRole("button", { name: "Effacer" }));
  expect(await screen.findByText("Sync")).toBeTruthy();
  expect(screen.getByText("Arbre des pages")).toBeTruthy();
  expect(document.querySelectorAll("[aria-roledescription=draggable]")).toHaveLength(3);
});

test("the empty state explains the tree and offers a new ticket; a loading snapshot shows a skeleton", async () => {
  const m = createMockSdk(manifest);
  const { unmount } = mount(m);
  const empty = (await screen.findByText("Aucun ticket pour l'instant.")).closest("div");
  expect(empty?.textContent).toContain(
    "Les tickets s'organisent en arbre : un ticket, ses sous-tickets, leurs dépendances.",
  );
  expect(screen.getAllByRole("button", { name: "Nouveau ticket" })).toHaveLength(1);
  fireEvent.click(within(empty ?? document.body).getByRole("button", { name: "Nouveau ticket" }));
  expect(m.newTicketRequests).toHaveLength(1);
  expect(screen.queryByRole("searchbox")).toBeNull();
  unmount();
  render(
    <SdkProvider sdk={{ ...m.sdk, list: () => new Promise(() => {}) }}>
      <Component />
    </SdkProvider>,
  );
  await waitFor(() => expect(document.querySelectorAll("[data-slot=skeleton]")).toHaveLength(5));
  expect(screen.queryByText("Aucun ticket pour l'instant.")).toBeNull();
});

test("shared selection: the selected sub-ticket and its ancestors stay sharp, the chip clears it", async () => {
  const m = createMockSdk(manifest, { seed });
  m.setSelection({
    kind: "ticket",
    ids: [m.snapshot().tickets.find((t) => t.title === "Déplacement")?.id ?? ""],
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const row = async (title: string) =>
    (await screen.findByRole("button", { name: title })).closest<HTMLElement>("[data-selected]");
  const child = await row("Déplacement");
  const parent = await row("Arbre des pages");
  const other = await row("Sync");
  expect(child?.getAttribute("data-selected")).toBe("true");
  expect(parent?.getAttribute("data-selected")).toBe("false");
  expect(parent?.className).not.toContain("opacity-50");
  expect(other?.getAttribute("data-selected")).toBe("false");
  expect(other?.className).toContain("opacity-50");
  expect(screen.getByText("1 sélectionné")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Effacer la sélection" }));
  expect(m.selections.at(-1)).toBeNull();
  await waitFor(() => expect(screen.queryByText("1 sélectionné")).toBeNull());
  expect(other?.className).not.toContain("opacity-50");
});

test("without a selection: no chip and no fading in the tree", async () => {
  render(
    <SdkProvider sdk={createMockSdk(manifest, { seed }).sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("KIB-1")).toBeTruthy();
  expect(document.querySelector(".opacity-50")).toBeNull();
  expect(document.querySelectorAll("[data-selected='true']")).toHaveLength(0);
  expect(screen.queryByRole("button", { name: "Effacer la sélection" })).toBeNull();
});

test("a narrow widget keeps key and title, hides the wide cells below @md", async () => {
  const m = createMockSdk(manifest, { seed, surface: "widget", format: "medium" });
  const { getByRole, getAllByRole, getByText, getAllByText, container, findByText } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await findByText("KIB-1");
  const root = container.querySelector("section");
  expect(root?.className).toContain("@container");
  expect(COLUMNS).toBe(
    "grid grid-cols-[minmax(0,1fr)_1.5rem_2rem] items-center gap-3 px-2 @md:grid-cols-[minmax(0,1fr)_7rem_5rem_4rem] @3xl:grid-cols-[minmax(0,1fr)_7.5rem_10rem_5rem_4rem]",
  );
  const header = getByText("Sous-tickets").parentElement ?? document.body;
  expect(within(header).getByText("Ticket").className).not.toContain("hidden");
  expect(within(header).getByText("Statut").className).toContain(WIDE_CELL);
  expect(within(header).getByText("Sous-tickets").className).toContain(WIDE_CELL);
  const title = getByRole("button", { name: /^Arbre des pages/ });
  expect(title.className).toContain("min-w-0");
  expect(title.className).not.toContain("min-w-16");
  for (const progress of Array.from(container.querySelectorAll("[data-cell='progress']")))
    expect(progress.className).toContain(WIDE_CELL);
  expect(container.querySelector("[data-cell='status'] span.truncate")?.className).toContain(WIDE_TEXT);
  expect(getAllByText("Bloqué").length).toBeGreaterThan(0);
  expect(getAllByText("À faire")[0]?.className).toContain(WIDE_TEXT);
  expect(getByText("Attente client").className).toContain(WIDE_TEXT);
  for (const plus of getAllByRole("button", { name: /^Nouveau sous-ticket/ }))
    expect(plus.className).toContain("hidden @md:inline-flex");
});

test("labels: the menu groups the project's labels, checking one narrows the tree, rows show two chips then +n", async () => {
  const m = createMockSdk(manifest, { seed: (run) => seedDemo(run) });
  mount(m);
  const user = userEvent.setup();
  await screen.findByText("Schéma Loro des tickets (LoroTree)");
  const row = screen.getByRole("button", { name: "Schéma Loro des tickets (LoroTree)" }).parentElement;
  const chips = within(row ?? document.body);
  expect(chips.getByText("area:api")).toBeTruthy();
  expect(chips.getByText("phase:p1")).toBeTruthy();
  expect(chips.queryByText("urgent")).toBeNull();
  const classes = chips.getByText("+1").parentElement?.classList;
  expect(classes?.contains("hidden") && classes.contains("@md:inline-flex")).toBe(true);
  await user.click(screen.getByRole("button", { name: "Étiquettes" }));
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitemcheckbox")
      .map((i) => i.textContent),
  ).toEqual(["urgent", "area:api", "phase:p1"]);
  expect(within(menu).getByText("Libres")).toBeTruthy();
  expect(within(menu).getByText("area")).toBeTruthy();
  await user.click(within(menu).getByRole("menuitemcheckbox", { name: "area:api" }));
  await user.keyboard("{Escape}");
  expect(screen.getByRole("button", { name: /^Étiquettes/ }).textContent).toContain("1");
  expect(screen.getByText("Schéma Loro des tickets (LoroTree)")).toBeTruthy();
  expect(screen.getByText("Noyau de données")).toBeTruthy();
  expect(screen.queryByText("Kanban : drag & drop entre colonnes")).toBeNull();
  expect(screen.queryByText("UI de base")).toBeNull();
  await user.click(screen.getByRole("button", { name: "Effacer" }));
  expect(await screen.findByText("Kanban : drag & drop entre colonnes")).toBeTruthy();
});

test("labels: the menu is disabled when the project has no label", async () => {
  const m = createMockSdk(manifest, { seed });
  mount(m);
  await screen.findByText("Arbre des pages");
  expect(screen.getByRole("button", { name: "Étiquettes" }).hasAttribute("disabled")).toBe(true);
});
