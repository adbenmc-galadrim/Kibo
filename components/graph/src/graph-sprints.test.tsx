import { afterEach, expect, setSystemTime, test } from "bun:test";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SEED_TODAY, seedSprintGraph } from "./graph-sprints-seed";
import { Component, manifest } from "./index";
import { SprintLanes } from "./SprintLanes";
import { sprintLanes } from "./sprint-lanes";
import { KIT_DAY_AFTER, kitInput, kitTickets } from "./sprint-lanes-kit";

afterEach(cleanup);

type Execution = "hidden" | "shown";

const setup = (seed = seedSprintGraph, config: Record<string, unknown> = {}, agentExecution?: Execution) => {
  const m = createMockSdk(manifest, {
    seed,
    surface: "view",
    viewer: "adam",
    today: SEED_TODAY,
    config,
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
const kitModel = (today?: string) => {
  const model = sprintLanes(kitInput(today === undefined ? {} : { tickets: kitTickets(today) }));
  if (model === null) throw new Error("expected lanes");
  return model;
};

test("the manifest reads sprints and questions and declares the columns", () => {
  expect(manifest.reads).toEqual(expect.arrayContaining(["sprint", "question"]));
  expect(manifest.configSchema?.columns).toMatchObject({ enum: ["sprints", "waves"], default: "sprints" });
  expect(manifest.configSchema?.collapseDelivered).toMatchObject({ type: "boolean", default: true });
});

test("sprints mode: toolbar, counter, one column per sprint and the reserve", async () => {
  setup();
  const region = await lanes();
  expect(screen.getByRole("button", { name: "Regrouper : Fonctionnalités" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Colonnes : Sprints" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Livrées repliées" }).getAttribute("aria-pressed")).toBe("true");
  expect(
    screen.getByText("9 fonctionnalités · 2 dépendances entre étapes, 8 entre fonctionnalités"),
  ).toBeTruthy();
  const columns = within(region)
    .getAllByRole("group")
    .map((g) => g.getAttribute("aria-label"));
  expect(columns).toEqual([
    "S41 Accès",
    "S42 Terrain hors ligne",
    "S43 Import et soudures",
    "S44 Rapports",
    "À planifier",
  ]);
  const s42 = within(region).getByRole("group", { name: "S42 Terrain hors ligne" });
  expect(within(s42).getByText("se termine aujourd'hui")).toBeTruthy();
  expect(within(region).getByRole("group", { name: "S41 Accès" }).textContent).toContain("terminé le 9 oct.");
  expect(screen.queryByRole("radio", { name: "Vagues" })).toBeNull();
  expect(screen.getByRole("list", { name: "Légende" }).textContent).toContain("Colonne = sprint");
});

test("« Livrées repliées » unfolds delivered features", async () => {
  setup();
  const region = await lanes();
  const f1 = within(region).getByRole("article", { name: /^F1 / });
  expect(within(f1).queryAllByRole("listitem")).toHaveLength(0);
  await userEvent.click(screen.getByRole("button", { name: "Livrées repliées" }));
  expect(within(within(region).getByRole("article", { name: /^F1 / })).getAllByRole("listitem")).toHaveLength(
    4,
  );
});

test("the former controls live in « Options »", async () => {
  setup();
  await lanes();
  await userEvent.click(screen.getByRole("button", { name: "Options" }));
  const menu = await screen.findByRole("menu");
  for (const name of ["Chemin critique", "Démarrables"])
    expect(within(menu).getByRole("menuitemcheckbox", { name })).toBeTruthy();
  expect(within(menu).getByRole("menuitemcheckbox", { name: /^Afficher les terminés/ })).toBeTruthy();
  expect(within(menu).getByRole("menuitemradio", { name: "Moi" })).toBeTruthy();
  expect(within(menu).getByRole("menuitemradio", { name: "Tous les domaines" })).toBeTruthy();
});

test("« Colonnes : Vagues » brings back the waves toolbar, and back", async () => {
  setup();
  await lanes();
  await userEvent.click(screen.getByRole("button", { name: "Colonnes : Sprints" }));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "Vagues" }));
  expect(await screen.findByRole("radio", { name: "Vagues" })).toBeTruthy();
  expect(screen.getByRole("region", { name: "Graphe des dépendances" })).toBeTruthy();
  await userEvent.click(screen.getByRole("button", { name: "Colonnes : Vagues" }));
  await userEvent.click(await screen.findByRole("menuitemradio", { name: "Sprints" }));
  expect(await lanes()).toBeTruthy();
});

test("the config can open the graph in waves", async () => {
  setup(seedSprintGraph, { columns: "waves" });
  expect(await screen.findByRole("radio", { name: "Vagues" })).toBeTruthy();
});

test("without any sprint the columns switch is disabled and the waves stay", async () => {
  setup((run) => {
    run({ method: "createTicket", title: "Seul", assignee: { kind: "human", ref: "adam" } });
  });
  const columns = await screen.findByRole("button", { name: "Colonnes : Vagues" });
  expect(columns.hasAttribute("disabled")).toBe(true);
  expect(columns.closest("[title]")?.getAttribute("title")).toBe("Aucun sprint");
  expect(screen.getByRole("radio", { name: "Vagues" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.queryByRole("region", { name: "Fonctionnalités par sprint" })).toBeNull();
});

test("a frame lists its steps, the session row is outlined in orange", () => {
  render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
  const f4 = screen.getByRole("article", { name: "F4 Saisir un tronçon hors ligne" });
  const rows = within(f4).getAllByRole("listitem");
  expect(rows.map((r) => r.textContent)).toEqual([
    "Schéma local des tronçons",
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

test("the legend names the mode", () => {
  render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
  const legend = screen.getByRole("list", { name: "Légende" });
  expect(
    within(legend)
      .getAllByRole("listitem")
      .map((i) => i.textContent),
  ).toEqual([
    "À faire",
    "En cours",
    "En review",
    "Bloqué",
    "Fonctionnalité",
    "Colonne = sprint",
    "Session active",
  ]);
});

test("the Légende button folds the legend and the choice is remembered", async () => {
  localStorage.removeItem("kibo.graph.legend");
  const first = render(
    <SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />,
  );
  const toggle = screen.getByRole("button", { name: "Légende" });
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
  await userEvent.click(toggle);
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
  expect(screen.getByRole("button", { name: "Légende" }).getAttribute("aria-expanded")).toBe("false");
  first.unmount();
  render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
  expect(screen.queryByRole("list", { name: "Légende" })).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Légende" }));
  expect(screen.getByRole("list", { name: "Légende" })).toBeTruthy();
  localStorage.removeItem("kibo.graph.legend");
});

test("the legend opens when the storage cannot be read", () => {
  const getItem = Storage.prototype.getItem;
  Storage.prototype.getItem = () => {
    throw new Error("denied");
  };
  try {
    render(<SprintLanes model={kitModel()} onOpen={() => undefined} onNewFeature={() => undefined} />);
    expect(screen.getByRole("list", { name: "Légende" })).toBeTruthy();
  } finally {
    Storage.prototype.getItem = getItem;
  }
});

test("clicking a frame title or a step opens the ticket", async () => {
  const opened: string[] = [];
  render(<SprintLanes model={kitModel()} onOpen={(id) => opened.push(id)} onNewFeature={() => undefined} />);
  await userEvent.click(screen.getByRole("button", { name: "Saisir un tronçon hors ligne" }));
  await userEvent.click(screen.getByRole("button", { name: "Conflits de saisie" }));
  expect(opened).toEqual(["EMIS-40", "EMIS-45"]);
});

const TESTS_STEP = "Envoyer les photos d'un tronçon · étape 4";

async function withLiveRun(agentExecution: Execution) {
  const m = setup(seedSprintGraph, {}, agentExecution);
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
    const s42 = within(region).getByRole("group", { name: "S42 Terrain hors ligne" });
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
