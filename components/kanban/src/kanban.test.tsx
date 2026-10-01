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
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
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
  const m = createMockSdk(manifest, { seed, viewer: "adam" });
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
  expect(within(todo).getByText("2")).toBeTruthy();
  expect(within(todo).getAllByRole("article")[0]?.getAttribute("tabindex")).toBe("0");
  expect(screen.getByRole("region", { name: "Bloqué" })).toBeTruthy();
  expect(screen.getByText("5 / 6 · Moi + agents")).toBeTruthy();
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
    ref: { kind: "github_pr", url: "https://github.com/adam/kibo/pull/12", number: 12, state: "open" },
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
  expect(await screen.findByText("Issue synchronisée")).toBeTruthy();
  expect(screen.getByText("Sous-tâche locale")).toBeTruthy();
  expect(screen.queryByText("Ticket local")).toBeNull();
  expect(screen.getByText("3 / 3 · Tous")).toBeTruthy();
  const chip = await screen.findByLabelText("CI cassée");
  expect(chip.parentElement?.textContent).toBe("#12");
  expect(screen.queryByLabelText("CI réussie")).toBeNull();
});

test("the CI chip follows the tones of the ticket sheet", async () => {
  const m = createMockSdk(manifest, {
    seed: syncedSeed,
    config: { source: { bindingId: "b1" } },
    ciRuns: [
      ciRun({ ticketKey: "KIB-1", prNumber: 3, status: "in_progress", conclusion: null }),
      ciRun({ ticketKey: "KIB-2", prNumber: 4, conclusion: "success" }),
      ciRun({ ticketKey: "KIB-4", prNumber: null, conclusion: "cancelled" }),
    ],
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect((await screen.findByLabelText("CI en cours")).parentElement?.textContent).toBe("#3");
  expect(screen.getByLabelText("CI réussie").parentElement?.textContent).toBe("#4");
  expect(screen.getByLabelText("CI sans verdict").parentElement?.textContent).toBe("");
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
  expect((await screen.findByLabelText("CI cassée")).parentElement?.textContent).toBe("#12");
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
  expect(await screen.findByText("Issue synchronisée")).toBeTruthy();
  expect(screen.queryByRole("alert")).toBeNull();
});

test("shows member names and provisional keys", async () => {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    config: { filter: "all" },
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

test("shows a colleague's run on the card", async () => {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    presence: [
      {
        deviceId: "d2",
        self: false,
        userId: "u-lea",
        name: "Léa",
        pageId: null,
        ticketId: null,
        runs: [{ ticketKey: "KIB-1", profile: "opus-dev-1", state: "running" }],
      },
    ],
    seed: (run) =>
      run({ method: "createTicket", title: "Schéma", assignee: { kind: "agent", ref: "opus-dev-1" } }),
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("opus-dev-1 · Léa")).toBeTruthy();
});

test("cards cannot be moved in a read-only project", async () => {
  const m = createMockSdk(manifest, {
    viewer: "adam",
    config: { filter: "all" },
    shared: true,
    seed: (run) => run({ method: "createTicket", title: "Lecture" }),
  });
  m.setAccess("read-only");
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await screen.findByText("KIB-…");
  await waitFor(() => expect(screen.queryByRole("button", { name: /^Actions / })).toBeNull());
  expect(screen.queryByRole("button", { name: /Nouveau ticket dans/ })).toBeNull();
  expect(screen.getByRole("article", { name: /Lecture/ }).getAttribute("tabindex")).toBeNull();
  await userEvent
    .setup()
    .pointer({ keys: "[MouseRight]", target: screen.getByRole("button", { name: "Lecture" }) });
  expect((await screen.findAllByRole("menuitem")).map((i) => i.textContent)).toEqual(["Ouvrir"]);
});

test("in a shared project, 'Moi + agents' follows the account id", async () => {
  const m = createMockSdk(manifest, {
    viewer: "u-adam",
    shared: true,
    seed: (run) => {
      run({ method: "createTicket", title: "À moi", assignee: { kind: "human", ref: "u-adam" } });
      run({ method: "createTicket", title: "Au nom local", assignee: { kind: "human", ref: "adam" } });
    },
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  expect(await screen.findByText("À moi")).toBeTruthy();
  expect(screen.queryByText("Au nom local")).toBeNull();
});
