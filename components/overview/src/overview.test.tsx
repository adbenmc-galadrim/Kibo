import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { LAZY_FALLBACK_SELECTOR, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk, type MockSdkOptions } from "@kibo/sdk/mock";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest, overviewPanel } from "./index";
import { NOW, seed, TODAY } from "./test-seed";

beforeEach(() => setSystemTime(new Date(NOW)));
afterEach(() => {
  setSystemTime();
  cleanup();
});

runConformance({ manifest, Component }, seed);

const event = (id: number, source: ProjectEvent["source"], data: ProjectEvent["data"]): ProjectEvent => ({
  id,
  projectId: "mock",
  at: NOW - (100 - id) * 60_000,
  kind: source === "git" ? "pr_opened" : "step_set",
  ticketId: null,
  featureId: null,
  source,
  data,
});

function setup(opts: MockSdkOptions = {}) {
  const m = createMockSdk(manifest, { seed, today: TODAY, description: "Suivi de chantier", ...opts });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
}
const card = (name: string | RegExp) => screen.findByRole("region", { name });

test("the overview is loaded on demand behind a neutral loading line", async () => {
  const m = createMockSdk(manifest, { seed, today: TODAY });
  const Panel = overviewPanel();
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Panel />
    </SdkProvider>,
  );
  expect(container.querySelector(LAZY_FALLBACK_SELECTOR)?.textContent).toBe(
    "Chargement de la vue d'ensemble…",
  );
  expect(await card("Échéances")).toBeTruthy();
});

test("the manifest reads the tracking entities and writes only runs", () => {
  expect(manifest.reads).toEqual([
    "ticket",
    "link",
    "status",
    "sprint",
    "question",
    "project_event",
    "ci_run",
  ]);
  expect(manifest.writes).toEqual(["run"]);
  expect(manifest.formats).toEqual(["full"]);
  expect(manifest.size?.min).toEqual({ w: 6, h: 6 });
});

test("the heading, the indicators and the cards of the project", async () => {
  setup();
  expect(await screen.findByRole("heading", { name: "Mock" })).toBeTruthy();
  expect(screen.getByText("Suivi de chantier")).toBeTruthy();
  const indicators = await card("Indicateurs du projet");
  expect(within(indicators).getByText("livrées sur 9")).toBeTruthy();
  expect(within(indicators).getByText("finit ce soir")).toBeTruthy();
  expect(within(indicators).getByText("limite atteinte")).toBeTruthy();
  expect(within(indicators).getByText("#20 · #22 · #23")).toBeTruthy();
  expect(within(indicators).getByText("Q14 bloque F6")).toBeTruthy();
  expect(within(await card("En ce moment")).getByText("Aucune session T3 Code")).toBeTruthy();
  const deadlines = await card("Échéances");
  expect(within(deadlines).getByText("glisse en S43")).toBeTruthy();
  expect(within(deadlines).getByText("bloquée · Q14")).toBeTruthy();
  const sprint = await card("Sprint S42 · Terrain hors ligne");
  expect(within(sprint).getByText("2/2 ouvertes")).toBeTruthy();
  expect(
    within(sprint).getByText("Limite de 2 ouvertes atteinte : F6 attendra la fin de F4 ou de F5."),
  ).toBeTruthy();
  const review = await card("En review");
  expect(within(review).getByText("CI verte")).toBeTruthy();
  expect(within(review).getByText("changements demandés")).toBeTruthy();
  expect(within(review).getByText("CI en cours")).toBeTruthy();
  const questions = await card("Questions");
  expect(within(questions).getByText("bloquante")).toBeTruthy();
  expect(within(questions).getByText(/^Q14 · Client · /)).toBeTruthy();
});

test("copy puts the command of the next step in the clipboard while execution is hidden", async () => {
  const copied: string[] = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => void copied.push(text) },
  });
  const m = setup();
  const next = await card("Prochaine à finir");
  expect(within(next).getByText("changements demandés")).toBeTruthy();
  const key = m.snapshot().tickets.find((t) => t.title === "Conflits de saisie")?.keyLabel;
  expect(within(next).getByText(`/full-delivery ${key}`)).toBeTruthy();
  await userEvent.click(within(next).getByRole("button", { name: "Copier" }));
  expect(copied).toEqual([`/full-delivery ${key}`]);
  expect(m.runDeliveries).toEqual([]);
});

test("deliver starts the run of the next step when execution is shown", async () => {
  const m = setup({ agentExecution: "shown" });
  const next = await card("Prochaine à finir");
  await userEvent.click(await within(next).findByRole("button", { name: "Livrer" }));
  const step = m.snapshot().tickets.find((t) => t.title === "Conflits de saisie");
  await waitFor(() => expect(m.runDeliveries).toEqual([step?.id ?? ""]));
});

test("features, sprint and questions open in the shell", async () => {
  const m = setup();
  const sprint = await card("Sprint S42 · Terrain hors ligne");
  await userEvent.click(within(sprint).getByRole("button", { name: "Sprint S42 · Terrain hors ligne" }));
  expect(m.openedSprints).toEqual([m.snapshot().sprints.find((s) => s.code === "S42")?.id ?? ""]);
  await userEvent.click(within(sprint).getByRole("button", { name: "Saisir un tronçon hors ligne" }));
  const f4 = m.snapshot().tickets.find((t) => t.title === "Saisir un tronçon hors ligne");
  expect(m.opened).toEqual([f4?.id ?? ""]);
  const questions = await card("Questions");
  await userEvent.click(
    within(questions).getByRole("button", { name: "Un ISO réaffecté garde-t-il ses photos ?" }),
  );
  const q14 = m.snapshot().questions.find((q) => q.importRef?.id === "Q14");
  expect(m.viewRequests).toEqual([{ componentId: "questions", question: q14?.id ?? null }]);
});

test("the activity shows four events, filters by source and unfolds on fifty", async () => {
  const events = Array.from({ length: 60 }, (_, i) =>
    event(i + 1, i % 2 === 0 ? "git" : "full-delivery", i % 2 === 0 ? { number: i + 1 } : { step: 7 }),
  );
  setup({ events });
  const activity = await card("Activité");
  const items = () => within(activity).queryAllByRole("listitem");
  await waitFor(() => expect(items().length).toBe(4));
  expect(items()[0]?.textContent).toContain("Étape 7 · Porte qualité");
  await userEvent.click(within(activity).getByRole("button", { name: "git" }));
  expect(items().every((li) => li.textContent?.includes("PR #"))).toBe(true);
  await userEvent.click(within(activity).getByRole("button", { name: "git" }));
  await userEvent.click(within(activity).getByRole("button", { name: "Activité" }));
  expect(items().length).toBe(50);
});
