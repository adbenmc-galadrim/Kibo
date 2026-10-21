import { afterEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SeedRun } from "./graph-seed";
import { SEED_TODAY, seedSprintGraph } from "./graph-sprints-seed";
import { Component, manifest } from "./index";
import { SprintLanes } from "./SprintLanes";
import { sprintLanes } from "./sprint-lanes";
import { KIT_DAY_AFTER, kitInput, kitTickets } from "./sprint-lanes-kit";

afterEach(cleanup);

type Execution = "hidden" | "shown";
type MockHold = NonNullable<MockSdkOptions["holds"]>[number];

type Options = { config?: Record<string, unknown>; agentExecution?: Execution; holds?: MockHold[] };

const setup = (seed = seedSprintGraph, { config = {}, agentExecution, holds = [] }: Options = {}) => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    viewer: "adam",
    today: SEED_TODAY,
    config,
    holds,
    ...(agentExecution === undefined ? {} : { agentExecution }),
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const lanes = () => screen.findByRole("region", { name: "Fonctionnalités par sprint" });
const kitModel = (today?: string) =>
  sprintLanes(kitInput(today === undefined ? {} : { tickets: kitTickets(today) }));

test("the manifest reads the tracking entities, emits no selection and keeps the widget filter only", () => {
  expect(manifest.reads).toEqual(["ticket", "status", "link", "run", "sprint", "question"]);
  expect(manifest.selection).toBe(false);
  expect(Object.keys(manifest.configSchema ?? {})).toEqual(["filter"]);
});

test("sprints mode: toolbar, counter, one column per sprint and the reserve", async () => {
  setup();
  const region = await lanes();
  for (const name of ["Livrées repliées", "Options", "Colonnes : Sprints", "Regrouper : Fonctionnalités"])
    expect(screen.queryByRole("button", { name })).toBeNull();
  expect(
    screen.getByText("9 fonctionnalités · 2 dépendances entre étapes, 8 entre fonctionnalités"),
  ).toBeTruthy();
  const columns = within(region)
    .getAllByRole("group")
    .map((g) => g.getAttribute("aria-label"));
  expect(columns).toEqual([
    "S41 Accès",
    "S42 Saisie hors ligne",
    "S43 Import et contrats",
    "S44 Rapports",
    "À planifier",
  ]);
  const s42 = within(region).getByRole("group", { name: "S42 Saisie hors ligne" });
  expect(within(s42).getByText("se termine aujourd'hui")).toBeTruthy();
  expect(within(region).getByRole("group", { name: "S41 Accès" }).textContent).toContain("terminé le 9 oct.");
  expect(screen.getByRole("list", { name: "Légende" }).textContent).toContain("Colonne = sprint");
});

test("the bar holds the « Vue » switch and the counter only, « Fonctionnalités » first", async () => {
  localStorage.clear();
  setup();
  await lanes();
  const bar = screen.getByRole("radiogroup", { name: "Vue" });
  expect(
    within(bar)
      .getAllByRole("radio")
      .map((r) => [r.textContent, r.getAttribute("aria-checked")]),
  ).toEqual([
    ["Fonctionnalités", "true"],
    ["PRs", "false"],
  ]);
  const toolbar = bar.parentElement;
  expect(toolbar?.querySelectorAll("button")).toHaveLength(2);
  expect(toolbar?.textContent).toBe(
    "FonctionnalitésPRs9 fonctionnalités · 2 dépendances entre étapes, 8 entre fonctionnalités",
  );
});

test("« PRs » swaps the columns for the PR view and is remembered for this instance", async () => {
  localStorage.clear();
  const m = setup();
  await lanes();
  await userEvent.click(screen.getByRole("radio", { name: "PRs" }));
  expect(await screen.findByRole("region", { name: "PR ouvertes" })).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Fonctionnalités par sprint" })).toBeNull();
  expect(screen.getByRole("radio", { name: "PRs" }).getAttribute("aria-checked")).toBe("true");
  expect(localStorage.getItem(`kibo.graph.view.${m.sdk.instanceId}`)).toBe("prs");
  await userEvent.click(screen.getByRole("radio", { name: "Fonctionnalités" }));
  expect(await lanes()).toBeTruthy();
  expect(localStorage.getItem(`kibo.graph.view.${m.sdk.instanceId}`)).toBe("features");
  localStorage.clear();
});

test("a stored « prs » opens the PR view", async () => {
  localStorage.setItem("kibo.graph.view.mock-instance", "prs");
  setup();
  expect(await screen.findByRole("region", { name: "PR ouvertes" })).toBeTruthy();
  expect(screen.getByRole("radio", { name: "PRs" }).getAttribute("aria-checked")).toBe("true");
  localStorage.clear();
});

test("a storage that cannot be read keeps « Fonctionnalités »", async () => {
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = () => {
    throw new Error("denied");
  };
  try {
    setup();
    expect(await lanes()).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Fonctionnalités" }).getAttribute("aria-checked")).toBe("true");
  } finally {
    Storage.prototype.getItem = getItem;
  }
});

test("a delivered feature is folded, even with the former config keys, and its title opens it", async () => {
  const m = setup(seedSprintGraph, {
    config: { collapseDelivered: false, showDone: true, columns: "waves" },
  });
  const region = await lanes();
  const f1 = within(region).getByRole("article", { name: /^F1 / });
  expect(within(f1).queryAllByRole("listitem")).toHaveLength(0);
  await userEvent.click(within(f1).getByRole("button", { name: "Se connecter avec Microsoft" }));
  const root = m.snapshot().tickets.find((t) => t.title === "Se connecter avec Microsoft");
  if (root === undefined) throw new Error("missing F1");
  expect(m.opened).toEqual([root.id]);
});

test("without any sprint a single « À planifier » column holds every feature", async () => {
  setup((run) => {
    const root = run({ method: "createTicket", title: "Exporter le dossier client" }) as { id: string };
    run({ method: "createTicket", title: "Format du dossier", parentId: root.id });
  });
  const region = await lanes();
  expect(
    within(region)
      .getAllByRole("group")
      .map((g) => g.getAttribute("aria-label")),
  ).toEqual(["À planifier"]);
  expect(within(region).getByRole("article", { name: /Exporter le dossier client$/ })).toBeTruthy();
});

test("a frame lists its steps, the session row is outlined in orange", () => {
  render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
  const f4 = screen.getByRole("article", { name: "F4 Saisir un constat hors ligne" });
  const rows = within(f4).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual([
    "Schéma local des constats",
    "Formulaire de saisie",
    "Synchro au retour du réseau",
    "Conflits de saisie",
    "Démo client",
  ]);
  expect(rows[3]?.getAttribute("data-session")).toBe("true");
  expect(rows[3]?.className).toContain("border-(--tracking-brand-line)");
  expect(rows[0]?.getAttribute("data-session")).toBeNull();
  expect(within(f4).getByText("3/5")).toBeTruthy();
});

test("footers: late slips to the next sprint, blocked names its question", () => {
  render(
    <SprintLanes model={kitModel(KIT_DAY_AFTER)} onOpen={() => undefined} onNewFeature={() => undefined} />,
  );
  const f5 = screen.getByRole("article", { name: /^F5 / });
  expect(within(f5).getByText("en retard · glisse en S43")).toBeTruthy();
  expect(f5.getAttribute("data-late")).toBe("true");
  const f6 = screen.getByRole("article", { name: /^F6 / });
  expect(within(f6).getByText("bloquée par Q14")).toBeTruthy();
});

test("clicking a frame title or a step opens the ticket", async () => {
  const opened: string[] = [];
  render(<SprintLanes model={kitModel()} onOpen={(id) => opened.push(id)} onNewFeature={() => undefined} />);
  await userEvent.click(screen.getByRole("button", { name: "Saisir un constat hors ligne" }));
  await userEvent.click(screen.getByRole("button", { name: "Conflits de saisie" }));
  expect(opened).toEqual(["SILO-40", "SILO-45"]);
});

test("a long title is clamped to its reserved lines inside the button", () => {
  const title = "Connexion, environnements et hébergement";
  const tickets = kitTickets().map((t) => (t.title === "Se connecter avec Microsoft" ? { ...t, title } : t));
  render(
    <SprintLanes
      model={sprintLanes(kitInput({ tickets }))}
      onOpen={() => undefined}
      onNewFeature={() => undefined}
    />,
  );
  const f1 = screen.getByRole("article", { name: `F1 ${title}` });
  expect(f1.getAttribute("data-title-lines")).toBe("3");
  expect(f1.style.height).toBe("96px");
  const button = within(f1).getByRole("button", { name: title });
  expect(button.getAttribute("title")).toBe(title);
  expect(within(button).getByText(title).className).toContain("line-clamp-3");
});

const TESTS_STEP = "Envoyer les photos d'un constat · étape 4";

async function withLiveRun(agentExecution: Execution) {
  const m = setup(seedSprintGraph, { agentExecution });
  await lanes();
  const step = m.snapshot().tickets.find((t) => t.title === TESTS_STEP);
  if (step === undefined) throw new Error("missing step");
  act(() => m.setRuns([{ ticketId: step.id, runId: "r1", label: "Opus", state: "running", position: null }]));
  const row = await screen.findByRole("button", { name: TESTS_STEP });
  return row.closest("li");
}

test("a live run lights the step only when the execution is shown", async () => {
  const row = await withLiveRun("shown");
  expect(row?.getAttribute("data-session")).toBe("true");
  expect(row?.className).toContain("border-(--tracking-brand-line)");
});

test("a live run stays dark when the execution is hidden", async () => {
  const row = await withLiveRun("hidden");
  expect(row?.getAttribute("data-session")).toBeNull();
  expect(row?.className).not.toContain("border-(--tracking-brand-line)");
});

test("a T3 Code session always lights the step, without any run", () => {
  render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
  const f5 = screen.getByRole("article", { name: /^F5 / });
  const row = within(f5).getByRole("button", { name: "Écran d'envoi hors ligne" }).closest("li");
  expect(row?.getAttribute("data-session")).toBe("true");
});

test("the sprint columns follow the host's day, not the browser clock", async () => {
  setSystemTime(new Date("2026-10-18T10:00:00"));
  try {
    setup();
    const region = await lanes();
    const s42 = within(region).getByRole("group", { name: "S42 Saisie hors ligne" });
    expect(await within(s42).findByText("se termine aujourd'hui")).toBeTruthy();
  } finally {
    setSystemTime();
  }
});

test("an empty project says what the Graphe is for and opens a new feature on the Planning", async () => {
  const m = setup((run) => {
    run({ method: "createSprint", code: "S1", name: "Sprint 1", start: "2026-10-12", end: "2026-10-23" });
  });
  await lanes();
  expect(screen.getByText("Les dépendances entre fonctionnalités et étapes apparaissent ici.")).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Nouvelle fonctionnalité" }));
  expect(m.viewRequests).toEqual([
    { componentId: "planning", question: null, intent: { kind: "newFeature" } },
  ]);
});

const MINIO = "Serveur MinIO de recette indisponible";
const hold = (ticketId: string, reason = MINIO): MockHold => ({ ticketId, reason, since: SEED_TODAY });

test("a held step shows a cyan dot and a pause icon with its reason, the dependency says which step it waits for", async () => {
  setup(seedSprintGraph, { holds: [hold("KIB-26")] });
  const region = await lanes();
  const f5 = within(region).getByRole("article", { name: /^F5 / });
  const segments = f5.querySelector('[data-slot="frame-segments"]');
  expect(segments?.querySelectorAll('[data-tone="hold"]')).toHaveLength(3);
  const rows = within(f5).getAllByRole("listitem");
  expect(rows.map((r) => r.querySelector("[data-tone]")?.getAttribute("data-tone"))).toEqual([
    "done",
    "review",
    "hold",
    "hold",
    "hold",
  ]);
  const own = within(f5).getByRole("img", { name: `En attente : ${MINIO}` });
  expect(own.getAttribute("class")).toContain("text-(--tracking-hold)");
  expect(within(f5).getAllByRole("img", { name: /^En attente de KIB-26$/ })).toHaveLength(2);
  expect(within(f5).getByRole("img", { name: "3 en attente" }).textContent).toBe("3");
});

test("the legend lists « En attente » after « Bloqué »", async () => {
  setup();
  await lanes();
  const items = within(screen.getByRole("list", { name: "Légende" }))
    .getAllByRole("listitem")
    .map((i) => i.textContent);
  expect(items.indexOf("En attente")).toBe(items.indexOf("Bloqué") + 1);
});

const LAST_F4_STEP = "Saisir un constat hors ligne · étape 5";
const lastF4StepDone = (run: SeedRun) =>
  seedSprintGraph((cmd) =>
    run(cmd.method === "createTicket" && cmd.title === LAST_F4_STEP ? { ...cmd, statusId: "done" } : cmd),
  );

test("a delivered feature with a held step lists it under its header", async () => {
  const m = setup(lastF4StepDone, { holds: [hold("KIB-21", "Règle de fusion à valider par le client")] });
  const region = await lanes();
  const f4 = within(region).getByRole("article", { name: /^F4 / });
  const rows = within(f4).getAllByRole("listitem");
  expect(rows.map((r) => within(r).getByRole("button").textContent)).toEqual([
    "Saisir un constat hors ligne · étape 4",
  ]);
  expect(within(f4).getByRole("img", { name: "1 en attente" })).toBeTruthy();
  expect(within(f4).getByLabelText("Livrée")).toBeTruthy();
  await userEvent.click(within(f4).getByRole("button", { name: "Saisir un constat hors ligne" }));
  const root = m.snapshot().tickets.find((t) => t.title === "Saisir un constat hors ligne");
  expect(m.opened).toEqual([root?.id ?? ""]);
});
