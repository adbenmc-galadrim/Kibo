import { expect, test } from "bun:test";
import {
  type CiRun,
  KiboError,
  type ProjectCommand,
  type ProjectSnapshot,
  type Ticket,
  type TicketRun,
} from "@kibo/schema";
import { LAZY_FALLBACK_SELECTOR, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, kanbanPanel, manifest } from "./index";
import { seed } from "./test-seed";

const runs = (s: ProjectSnapshot): TicketRun[] => {
  const id = (key: string) => s.tickets.find((t) => t.key === key)?.id ?? key;
  return [
    { ticketId: id("KIB-4"), runId: "r1", label: "opus-dev-2", state: "waiting_input", position: null },
    { ticketId: id("KIB-5"), runId: "r2", label: "opus-dev", state: "queued", position: 2 },
    { ticketId: id("KIB-6"), runId: "r3", label: "sonnet-review-1", state: "done", position: null },
  ];
};

test("the board is loaded on demand behind a neutral loading line", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  const Board = kanbanPanel();
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Board />
    </SdkProvider>,
  );
  const fallback = container.querySelector(LAZY_FALLBACK_SELECTOR);
  expect(fallback?.textContent).toBe("Chargement du Kanban…");
  expect(fallback?.className).toContain("text-muted-foreground");
  expect(await screen.findByRole("region", { name: "À faire" })).toBeTruthy();
  expect(container.querySelector(LAZY_FALLBACK_SELECTOR)).toBeNull();
});

runConformance({ manifest, Component }, seed, { runs });

const setup = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", agentExecution: "shown" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("columns follow the workflow, counter shows filtered / total, waiting badge is shown", async () => {
  setup();
  const todo = await screen.findByRole("region", { name: "À faire" });
  expect(within(todo).getByText("KIB-1")).toBeTruthy();
  expect(within(todo).getByText("À faire")).toBeTruthy();
  expect(within(todo).getByText("3")).toBeTruthy();
  expect(within(todo).getAllByRole("article")[0]?.getAttribute("tabindex")).toBe("0");
  expect(screen.getByRole("region", { name: "Bloqué" })).toBeTruthy();
  expect(screen.getByText("6 tickets · Tous")).toBeTruthy();
  expect(screen.getByText("attend KIB-1")).toBeTruthy();
});

test("moving a card changes its status", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: "En cours" }),
  });
  expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")?.statusId).toBe("in_progress");
});

test("blocking asks for a reason and refuses an empty one", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: "Bloqué…" }),
  });
  const confirm = await screen.findByRole("button", { name: "Bloquer" });
  expect(confirm.hasAttribute("disabled")).toBe(true);
  await user.type(screen.getByLabelText("Motif"), "Attente client");
  await user.click(confirm);
  const t = m.snapshot().tickets.find((x) => x.key === "KIB-2");
  expect(t).toMatchObject({ statusId: "blocked", blockedReason: "Attente client" });
  const blocked = screen.getByRole("region", { name: "Bloqué" });
  expect(await within(blocked).findByText("Motif : Attente client")).toBeTruthy();
});

test("right click opens the same menu as ⋯; delete asks then removes the card", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.pointer({
    keys: "[MouseRight]",
    target: await screen.findByRole("button", { name: "Arbre des pages" }),
  });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual([
    "Ouvrir",
    "Livrer",
    "Déplacer vers",
    "Supprimer…",
  ]);
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  const confirm = await screen.findByRole("alertdialog", { name: "Supprimer KIB-1 ?" });
  expect(confirm.textContent).toContain("Ses liens seront supprimés aussi. Cette action est irréversible.");
  await user.click(within(confirm).getByRole("button", { name: "Supprimer" }));
  await waitFor(() => expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")).toBeUndefined());
  await waitFor(() => expect(screen.queryByRole("button", { name: "Arbre des pages" })).toBeNull());
  expect(m.snapshot().links).toEqual([]);
});

test("Ouvrir from the menu opens the ticket in the host", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Ouvrir" }));
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-2")?.id ?? "missing";
  expect(m.opened).toEqual([id]);
});

test("the column '+' asks the host for a new ticket in that status, Bloqué included", async () => {
  const m = setup();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Nouveau ticket dans En cours" }));
  await user.click(screen.getByRole("button", { name: "Nouveau ticket dans Bloqué" }));
  expect(m.newTicketRequests).toEqual([
    { statusId: "in_progress", instanceId: "mock-instance" },
    { statusId: "blocked", instanceId: "mock-instance" },
  ]);
});

const setupFailing = () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  const sdk = { ...m.sdk, run: () => Promise.reject(new Error("daemon unreachable")) };
  render(
    <SdkProvider sdk={sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("a failed move shows an alert and keeps the status", async () => {
  const m = setupFailing();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-1" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: "En cours" }),
  });
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer KIB-1.");
  expect(m.snapshot().tickets.find((t) => t.key === "KIB-1")?.statusId).toBe("todo");
});

test("a failed block keeps the dialog open and shows an alert", async () => {
  setupFailing();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Actions KIB-2" }));
  await user.click(await screen.findByRole("menuitem", { name: "Déplacer vers" }));
  await user.pointer({
    keys: "[MouseLeft]",
    target: await screen.findByRole("menuitem", { name: "Bloqué…" }),
  });
  await user.type(await screen.findByLabelText("Motif"), "Attente client");
  await user.click(screen.getByRole("button", { name: "Bloquer" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de déplacer KIB-2.");
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test("an agent's card shows its run: neutral badge, state dot and short state", async () => {
  const m = setup();
  m.setRuns(runs(m.snapshot()));
  const badge = async (text: string) => (await screen.findByText(text)).closest("[data-slot=badge]");
  const waiting = await badge("· Attend");
  expect(waiting?.textContent).toBe("opus-dev-2· Attend");
  expect(waiting?.querySelector("[data-state]")?.getAttribute("data-state")).toBe("waiting_input");
  expect(waiting?.className).not.toContain("brand");
  expect((await badge("· En file #2"))?.textContent).toBe("opus-dev· En file #2");
  const done = await badge("sonnet-review");
  expect(done?.querySelector("[data-state]")).toBeNull();
});

const issueRef = (n: number) => ({
  kind: "github_issue" as const,
  bindingId: "b1",
  repo: "adam/kibo",
  number: n,
  nodeId: `I_${n}`,
  url: `https://github.com/adam/kibo/issues/${n}`,
});
const syncedSeed = (run: (cmd: ProjectCommand) => unknown) => {
  const a = run({ method: "importExternalTicket", title: "Issue synchronisée", ref: issueRef(1) }) as Ticket;
  run({ method: "createTicket", title: "Sous-tâche locale", parentId: a.id });
  run({ method: "createTicket", title: "Ticket local", assignee: { kind: "human", ref: "adam" } });
  const b = run({ method: "importExternalTicket", title: "Avec PR", ref: issueRef(2) }) as Ticket;
  run({
    method: "upsertExternalRef",
    ticketId: b.id,
    ref: {
      kind: "github_pr",
      url: "https://github.com/adam/kibo/pull/12",
      number: 12,
      state: "open",
      base: null,
      head: null,
      review: "none",
      checks: null,
    },
  });
};
const ciRun = (overrides: Partial<CiRun>): CiRun => ({
  repo: "adam/kibo",
  runId: 900,
  prNumber: 12,
  ticketKey: "KIB-4",
  headSha: "abc",
  workflow: "CI",
  status: "completed",
  conclusion: "failure",
  url: "https://github.com/adam/kibo/actions/runs/900",
  startedAt: null,
  updatedAt: "2026-09-26T10:03:12Z",
  jobs: [],
  ...overrides,
});

const renderSynced = (
  sdkOverride?: (m: ReturnType<typeof createMockSdk>) => ReturnType<typeof createMockSdk>["sdk"],
) => {
  const m = createMockSdk(manifest, {
    seed: syncedSeed,
    viewer: "adam",
    config: { source: { bindingId: "b1" } },
    ciRuns: [ciRun({ runId: 899, conclusion: "success", updatedAt: "2026-09-26T09:00:00Z" }), ciRun({})],
  });
  render(
    <SdkProvider sdk={sdkOverride ? sdkOverride(m) : m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

test("a synced Kanban shows only the binding's tickets, on the 'all' filter", async () => {
  renderSynced();
  expect(await screen.findByText("Sous-tâche locale")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Ouvrir l'ensemble F1 · Issue synchronisée" })).toBeTruthy();
  expect(screen.queryByText("Issue synchronisée")).toBeNull();
  expect(screen.queryByText("Ticket local")).toBeNull();
  expect(screen.getByText("2 tickets · Tous")).toBeTruthy();
  const chip = await screen.findByLabelText("CI cassée");
  expect(chip.closest("[data-ci]")?.textContent).toBe("CI cassée");
  expect(chip.closest("article")?.querySelector("[data-pr]")?.textContent).toBe("#12");
  expect(screen.queryByLabelText("CI réussie")).toBeNull();
});

test("the CI chip follows the tones of the ticket sheet", async () => {
  const m = createMockSdk(manifest, {
    seed: syncedSeed,
    config: { filter: "all" },
    ciRuns: [
      ciRun({ ticketKey: "KIB-2", prNumber: 3, status: "in_progress", conclusion: null }),
      ciRun({ ticketKey: "KIB-3", prNumber: 4, conclusion: "success" }),
      ciRun({ ticketKey: "KIB-4", prNumber: null, conclusion: "cancelled" }),
    ],
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const prOf = (label: string) => screen.getByLabelText(label).closest("article")?.querySelector("[data-pr]");
  expect((await screen.findByLabelText("CI en cours")).closest("[data-ci]")?.textContent).toBe("CI en cours");
  expect(prOf("CI en cours")?.textContent).toBe("#3");
  expect(screen.getByLabelText("CI réussie").closest("[data-ci]")?.textContent).toBe("CI");
  expect(prOf("CI réussie")?.textContent).toBe("#4");
  expect(screen.getByLabelText("CI sans verdict").closest("[data-ci]")?.textContent).toBe("CI");
  expect(prOf("CI sans verdict")?.textContent).toBe("#12");
});

test("the CI chip shows the worst latest run of each workflow", async () => {
  const m = createMockSdk(manifest, {
    seed: syncedSeed,
    config: { source: { bindingId: "b1" } },
    ciRuns: [
      ciRun({ runId: 1, workflow: "CI", conclusion: "failure", updatedAt: "2026-09-26T10:00:00Z" }),
      ciRun({
        runId: 2,
        workflow: "E2E",
        status: "in_progress",
        conclusion: null,
        updatedAt: "2026-09-26T10:01:00Z",
      }),
      ciRun({ runId: 3, workflow: "Lint", conclusion: "success", updatedAt: "2026-09-26T10:02:00Z" }),
    ],
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const broken = await screen.findByLabelText("CI cassée");
  expect(broken.closest("article")?.querySelector("[data-pr]")?.textContent).toBe("#12");
  expect(screen.queryByLabelText("CI réussie")).toBeNull();
});

test("an unavailable CI is stated, a missing GitHub account is not", async () => {
  renderSynced((m) => ({
    ...m.sdk,
    list: (type) =>
      type === "ci_run" ? Promise.reject(new KiboError("REMOTE_UNAVAILABLE", "timeout")) : m.sdk.list(type),
  }));
  expect((await screen.findByRole("alert")).textContent).toBe("CI indisponible : timeout");
  cleanup();
  renderSynced((m) => ({
    ...m.sdk,
    list: (type) =>
      type === "ci_run" ? Promise.reject(new KiboError("NOT_CONNECTED", "github")) : m.sdk.list(type),
  }));
  expect(await screen.findByText("Sous-tâche locale")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("a column scrolls its cards inside its own background", async () => {
  setup();
  const column = await screen.findByRole("region", { name: "À faire" });
  expect(column.className).toContain("min-h-0");
  const cards = column.querySelector('[data-slot="kanban-cards"]');
  if (!(cards instanceof HTMLElement)) throw new Error("cards container missing");
  expect(cards.className).toContain("overflow-y-auto");
  expect(cards.className).toContain("min-h-0");
  expect(cards.className).toContain("flex-1");
  expect(within(cards).getAllByRole("button").length).toBeGreaterThan(0);
  const board = column.parentElement;
  if (!board) throw new Error("board missing");
  expect(board.className).toContain("overflow-y-hidden");
});

test("shared selection: the selected card stands out, the others fade, the chip clears it", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  m.setSelection({ kind: "ticket", ids: [m.snapshot().tickets.find((t) => t.title === "Sync")?.id ?? ""] });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const card = await screen.findByRole("article", { name: /Sync/ });
  expect(card.getAttribute("data-selected")).toBe("true");
  const other = screen.getByRole("article", { name: /Arbre des pages/ });
  expect(other.getAttribute("data-selected")).toBe("false");
  expect(other.className).toContain("opacity-50");
  expect(card.className).not.toContain("opacity-50");
  expect(screen.getByText("1 sélectionné")).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Effacer la sélection" }));
  expect(m.selections.at(-1)).toBeNull();
  await waitFor(() => expect(screen.queryByText("1 sélectionné")).toBeNull());
  expect(other.className).not.toContain("opacity-50");
  expect(document.querySelectorAll("[data-selected='true']")).toHaveLength(0);
});

test("without a selection: no chip and no fading", async () => {
  setup();
  const card = await screen.findByRole("article", { name: /Sync/ });
  expect(card.getAttribute("data-selected")).toBe("false");
  expect(document.querySelector(".opacity-50")).toBeNull();
  expect(screen.queryByRole("button", { name: "Effacer la sélection" })).toBeNull();
});

const labelled = (run: (cmd: ProjectCommand) => unknown) => {
  const mine = { kind: "human", ref: "adam" } as const;
  run({ method: "createTicket", title: "API", assignee: mine, labels: ["area:api", "phase:p1", "urgent"] });
  run({ method: "createTicket", title: "Web", assignee: mine, labels: ["area:web"] });
  run({ method: "createTicket", title: "Nue", assignee: mine });
};

test("labels: cards show two chips then +n, the label menu narrows the board and is read back", async () => {
  const m = createMockSdk(manifest, { seed: labelled, viewer: "adam" });
  const mount = () =>
    render(
      <SdkProvider sdk={m.sdk}>
        <Component />
      </SdkProvider>,
    );
  mount();
  const user = userEvent.setup();
  const card = within(await screen.findByRole("article", { name: "KIB-1 API" }));
  expect(card.getByText("area:api")).toBeTruthy();
  expect(card.getByText("phase:p1")).toBeTruthy();
  expect(card.queryByText("urgent")).toBeNull();
  expect(card.getByText("+1")).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "Étiquette : toutes" }));
  const menu = await screen.findByRole("menu");
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .map((i) => i.textContent),
  ).toEqual(["Étiquette : toutes", "area:api", "area:web", "phase:p1", "urgent"]);
  await user.click(within(menu).getByRole("menuitemradio", { name: "area:web" }));
  expect(await screen.findByRole("button", { name: "Étiquette : area:web" })).toBeTruthy();
  expect(screen.getByText("Web")).toBeTruthy();
  expect(screen.queryByText("API")).toBeNull();
  expect(screen.queryByText("Nue")).toBeNull();
  expect(await m.sdk.data.get<string>("labelFilter")).toBe("area:web");
  cleanup();
  mount();
  expect(await screen.findByRole("button", { name: "Étiquette : area:web" })).toBeTruthy();
  expect(screen.queryByText("API")).toBeNull();
  await user.click(screen.getByRole("button", { name: /Tout afficher/ }));
  expect(await screen.findByText("API")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Étiquette : toutes" })).toBeTruthy();
  expect(await m.sdk.data.get<string>("labelFilter")).toBe("*");
});

test("a card shows its open questions, never a zero", async () => {
  const m = setup();
  const sync = m.snapshot().tickets.find((t) => t.title === "Sync")?.id ?? "";
  const ask = (title: string) =>
    m.run({ method: "createQuestion", ticketId: sync, title, createdBy: { kind: "agent", ref: "opus-dev" } });
  const todo = await screen.findByRole("region", { name: "À faire" });
  expect(within(todo).queryByText(/question/)).toBeNull();
  act(() => {
    ask("Un admin non affecté accède-t-il aux fichiers ?");
    ask("Bloquer le dépôt sur un client archivé ?");
  });
  const card = await within(todo).findByRole("article", { name: /Sync/ });
  const chip = await within(card).findByRole("button", { name: "2 questions, ouvrir" });
  expect(chip.textContent).toBe("2 questions");
  expect(chip.className).toContain("text-orange-600");
  expect(within(todo).getAllByText(/questions?$/)).toHaveLength(1);
});

test("the questions chip previews them on hover and opens the first one", async () => {
  const m = setup();
  const sync = m.snapshot().tickets.find((t) => t.title === "Sync")?.id ?? "";
  const ask = (title: string) =>
    m.run({ method: "createQuestion", ticketId: sync, title, createdBy: { kind: "agent", ref: "opus-dev" } });
  const todo = await screen.findByRole("region", { name: "À faire" });
  act(() => {
    ask("Un admin non affecté accède-t-il aux fichiers ?");
    ask("Bloquer le dépôt sur un client archivé ?");
  });
  const chip = await within(todo).findByRole("button", { name: "2 questions, ouvrir" });
  fireEvent.focus(chip);
  expect(await screen.findByText("Bloquer le dépôt sur un client archivé ?")).toBeTruthy();
  fireEvent.click(chip);
  const first = m.snapshot().questions.find((q) => q.title.startsWith("Un admin"))?.id;
  expect(m.viewRequests).toEqual([{ componentId: "questions", question: first ?? "" }]);
  expect(m.opened).toEqual([]);
});

const openMenu = async (key: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: `Actions ${key}` }));
  return user;
};

test("Livrer asks the SDK to deliver the ticket", async () => {
  const m = setup();
  const user = await openMenu("KIB-1");
  await user.click(await screen.findByRole("menuitem", { name: "Livrer" }));
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id;
  await waitFor(() => expect(m.runDeliveries).toEqual([id ?? ""]));
  expect(m.violations).toEqual([]);
});

test("Livrer is disabled while a run is active on the ticket", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", agentExecution: "shown" });
  const id = m.snapshot().tickets.find((t) => t.key === "KIB-1")?.id ?? "";
  m.setRuns([
    { ticketId: id, runId: "r1", label: "kib · full-delivery · KIB-1", state: "running", position: null },
  ]);
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await openMenu("KIB-1");
  const item = await screen.findByRole("menuitem", { name: /^Livrer/ });
  expect(item.getAttribute("aria-disabled")).toBe("true");
  expect(item.textContent).toContain("déjà un run : kib · full-delivery · KIB-1");
});

test("a card shows its delivery step next to the agent, never once done", async () => {
  const m = setup();
  const id = (key: string) => m.snapshot().tickets.find((t) => t.key === key)?.id ?? "";
  const delivery = { step: 7, note: "gates verts", at: 1, runId: null, kind: "delivery" as const };
  act(() => {
    m.run({ method: "setTicketDelivery", ticketId: id("KIB-4"), delivery });
    m.run({ method: "setTicketDelivery", ticketId: id("KIB-1"), delivery });
    m.run({ method: "setStatus", ticketId: id("KIB-1"), statusId: "done" });
  });
  const progress = await screen.findByRole("region", { name: "En cours" });
  const card = within(progress).getByRole("article", { name: /Récepteur/ });
  expect(within(card).getByText("Phase 7/12 · Porte qualité")).toBeTruthy();
  const done = screen.getByRole("region", { name: "Terminé" });
  expect(within(done).queryByText("Phase 7/12 · Porte qualité")).toBeNull();
});

test("without a delivery agent the menu has no Livrer", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam", deliveryAgent: null });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await openMenu("KIB-1");
  await screen.findByRole("menuitem", { name: "Ouvrir" });
  expect(screen.queryByRole("menuitem", { name: /^Livrer/ })).toBeNull();
});

test("with agent execution hidden, the card menu copies the full-delivery command instead of Livrer", async () => {
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const user = await openMenu("KIB-1");
  await user.click(await screen.findByRole("menuitem", { name: "Copier /full-delivery KIB-1" }));
  expect(screen.queryByRole("menuitem", { name: "Livrer" })).toBeNull();
  await waitFor(async () => expect(await navigator.clipboard.readText()).toBe("/full-delivery KIB-1"));
  expect(m.runDeliveries).toEqual([]);
});
