import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import type { ProjectEvent } from "@kibo/schema";
import { LAZY_FALLBACK_SELECTOR, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest, planningPanel } from "./index";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { seed, TODAY } from "./test-seed";

const DAY_AFTER = "2026-10-17";

beforeEach(() => setSystemTime(new Date(`${TODAY}T14:52:00`)));
afterEach(() => setSystemTime());

runConformance({ manifest, Component }, seed);

const tones = (card: HTMLElement) =>
  Array.from(card.querySelectorAll('[data-slot="step-cases"] > span')).map((s) =>
    s.getAttribute("data-tone"),
  );

test("the planning is loaded on demand behind a neutral loading line", async () => {
  const m = createMockSdk(manifest, { seed, today: TODAY });
  const Panel = planningPanel();
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Panel />
    </SdkProvider>,
  );
  expect(container.querySelector(LAZY_FALLBACK_SELECTOR)?.textContent).toBe("Chargement du Planning…");
  expect(await column(/^S41 /)).toBeTruthy();
});

test("one column per sprint with its code, dates and state, then the backlog", async () => {
  setupPlanning();
  const s41 = await column("S41 Accès");
  expect(within(s41).getByText("5–9 oct.")).toBeTruthy();
  expect(within(s41).getByText("terminé")).toBeTruthy();
  expect(within(s41).getByText("2/2 livrées")).toBeTruthy();
  const s42 = await column("S42 Terrain hors ligne");
  expect(s42.getAttribute("data-state")).toBe("current");
  expect(within(s42).getByText("se termine aujourd'hui")).toBeTruthy();
  expect(within(s42).getByText("1/3 livrées")).toBeTruthy();
  expect(within(await column("S43 Import et soudures")).getByText("2 prévues")).toBeTruthy();
  expect(within(await column("S44 Rapports")).getByText("1 prévue")).toBeTruthy();
  const backlog = await column("À planifier");
  expect(within(backlog).getByText("Glisse une fonctionnalité vers un sprint")).toBeTruthy();
  expect(within(backlog).getByRole("button", { name: /^F9 / })).toBeTruthy();
  expect(screen.getByText("3 fonctionnalités livrées sur 9 · 1 à planifier")).toBeTruthy();
  expect(screen.queryByText("Corriger l'export PDF")).toBeNull();
});

test("a case per step, in order, toned by status", async () => {
  setupPlanning();
  expect(tones(await cardIn(/^S42 /, "F4"))).toEqual(["done", "done", "done", "review", "todo"]);
  expect(tones(await cardIn(/^S42 /, "F5"))).toEqual(["done", "review", "progress", "todo", "todo"]);
  expect(tones(await cardIn(/^S43 /, "F6"))).toEqual(["blocked", "todo", "todo", "todo"]);
  expect(tones(await cardIn(/^S41 /, "F1"))).toEqual([]);
});

test("cards show their badge, step count, next step or the step in session", async () => {
  setupPlanning();
  const f6 = await cardIn(/^S43 /, "F6");
  expect(within(f6).getByText("bloquée · Q14")).toBeTruthy();
  expect(within(f6).getByText("0/4 étapes")).toBeTruthy();
  expect(within(f6).getByText("suivante : KIB-25")).toBeTruthy();
  const f5 = await cardIn(/^S42 /, "F5");
  expect(within(f5).getByText("KIB-21")).toBeTruthy();
  expect(within(await cardIn(/^S42 /, "F4")).getByText("en cours")).toBeTruthy();
  expect(within(await cardIn(/^S42 /, "F3")).getByText("livrée")).toBeTruthy();
});

test("a late feature is outlined in red with a warning under its sprint, from the day after its end", async () => {
  setSystemTime(new Date(`${DAY_AFTER}T09:00:00`));
  setupPlanning(DAY_AFTER);
  const f5 = await cardIn(/^S42 /, "F5");
  expect(within(f5).getByText("en retard")).toBeTruthy();
  const stroke = f5.querySelector("[data-slot=penpot-stroke] rect");
  expect(stroke?.getAttribute("stroke")).toBe("var(--tracking-red)");
  expect(within(await column(/^S42 /)).getByText("F5 en retard : 4 étapes restantes")).toBeTruthy();
  expect(within(await column(/^S42 /)).getByText("terminé")).toBeTruthy();
});

test("during its sprint, a feature at risk gets an amber warning, not a red outline", async () => {
  setupPlanning();
  const note = within(await column(/^S42 /)).getByText("F5 ne tiendra pas : 4 étapes restantes");
  expect(note.closest("[role=note]")?.className).toContain("text-(--tracking-amber)");
});

test("on the last day of its sprint a feature is neither late nor outlined", async () => {
  setupPlanning();
  const f5 = await cardIn(/^S42 /, "F5");
  expect(within(f5).queryByText("en retard")).toBeNull();
  expect(f5.querySelector("[data-slot=penpot-stroke]")).toBeNull();
  expect((await cardIn(/^S42 /, "F4")).querySelector("[data-slot=penpot-stroke]")).toBeNull();
});

test("open features against the limit: a warning, nothing disabled", async () => {
  setupPlanning();
  const badge = await screen.findByRole("button", { name: /En cours : 2 \/ 2/ });
  expect(badge.getAttribute("data-over")).toBe("false");
  expect(screen.getByRole("button", { name: "Fonctionnalité" }).hasAttribute("disabled")).toBe(false);
});

test("the open limit is the project's tracking setting, updated live", async () => {
  const { m } = setupPlanning(TODAY, { tracking: { openLimit: 3 } });
  expect(await screen.findByRole("button", { name: /En cours : 2 \/ 3/ })).toBeTruthy();
  m.setTracking({ openLimit: 1 });
  const badge = await screen.findByRole("button", { name: /En cours : 2 \/ 1/ });
  expect(badge.getAttribute("data-over")).toBe("true");
});

test("the open badge turns amber with a note above the limit, and lists the open features", async () => {
  const { m, seeded } = setupPlanning();
  const [first] = seeded.features.f7.steps;
  if (!first) throw new Error("step missing");
  m.run({ method: "setStatus", ticketId: first.id, statusId: "in_progress" });
  const badge = await screen.findByRole("button", { name: /En cours : 3 \/ 2/ });
  expect(badge.getAttribute("data-over")).toBe("true");
  expect(
    within(await column(/^S42 /)).getByText(/3 fonctionnalités en cours pour une limite de 2/),
  ).toBeTruthy();
  await userEvent.setup().click(badge);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText("Rapport de chantier journalier")).toBeTruthy();
});

test("columns is the default layout", async () => {
  setupPlanning();
  const bands = await screen.findByRole("button", { name: "Bandes" });
  expect(bands.getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("button", { name: "Colonnes" }).getAttribute("aria-pressed")).toBe("true");
});

test("clicking a feature title opens its sheet", async () => {
  const { m, seeded } = setupPlanning();
  await userEvent.setup().click(await screen.findByRole("button", { name: "Exporter le dossier client" }));
  await waitFor(() => expect(m.opened).toEqual([seeded.features.f9.root.id]));
});

test("a feature moved out of its sprint says where it slipped from", async () => {
  const sprintSet = (id: number, ticketId: string, from: string | null, to: string): ProjectEvent => ({
    id,
    projectId: "p",
    at: new Date(`${TODAY}T09:0${id}:00`).getTime(),
    kind: "sprint_set",
    ticketId,
    featureId: ticketId,
    source: "user",
    data: { from, to },
  });
  setupPlanning(TODAY, {
    journal: ({ features }) => [
      sprintSet(1, features.f8.root.id, null, "S42"),
      sprintSet(2, features.f8.root.id, "S42", "S43"),
      sprintSet(3, features.f6.root.id, null, "S43"),
    ],
  });
  await waitFor(async () =>
    expect(within(await cardIn(/^S43 /, "F8")).getByText("glissée de S42")).toBeTruthy(),
  );
  expect(within(await cardIn(/^S43 /, "F6")).queryByText(/^glissée/)).toBeNull();
});

test("a feature moved before its sprint starts has not slipped", async () => {
  const at = new Date(`${TODAY}T09:00:00`).getTime();
  const move = (ticketId: string): ProjectEvent => ({
    id: 1,
    projectId: "p",
    at,
    kind: "sprint_set",
    ticketId,
    featureId: ticketId,
    source: "user",
    data: { from: "S44", to: "S43" },
  });
  setupPlanning(TODAY, { journal: ({ features }) => [move(features.f8.root.id)] });
  const f8 = await cardIn(/^S43 /, "F8");
  expect(within(f8).queryByText(/^glissée/)).toBeNull();
});

test("the day comes from the daemon, not from the browser clock", async () => {
  setSystemTime(new Date(`${TODAY}T14:52:00`));
  setupPlanning(DAY_AFTER);
  expect(within(await cardIn(/^S42 /, "F5")).getByText("en retard")).toBeTruthy();
  expect(within(await column(/^S42 /)).getByText("terminé")).toBeTruthy();
});

test("a feature at risk wears the amber at-risk pill instead of in progress", async () => {
  setupPlanning();
  const pill = within(await cardIn(/^S42 /, "F5")).getByText("à risque");
  expect(pill.closest("span")?.className).toContain("text-(--tracking-amber)");
  expect(within(await cardIn(/^S42 /, "F5")).queryByText("en cours")).toBeNull();
});

test("each sprint header weighs its planned steps against its capacity", async () => {
  const { m } = setupPlanning();
  const s42 = within(await column(/^S42 /)).getByText("14 étapes prévues · capacité 5");
  expect(s42.getAttribute("data-over")).toBe("true");
  expect(s42.className).toContain("text-(--tracking-amber)");
  act(() => {
    m.run({ method: "createSprint", code: "S45", name: "Recette", start: "2026-11-02", end: "2026-11-13" });
  });
  const s45 = within(await column("S45 Recette")).getByText("0 étape prévue · capacité 10");
  expect(s45.getAttribute("data-over")).toBe("false");
});

test("two sprints overlap: the one that started last is current, for a new feature and the limit note", async () => {
  const { m } = setupPlanning(TODAY, { tracking: { openLimit: 1 } });
  act(() => {
    m.run({
      method: "createSprint",
      code: "S45",
      name: "Correctifs",
      start: "2026-10-14",
      end: "2026-10-20",
    });
  });
  const late = m.snapshot().sprints.find((s) => s.code === "S45")?.id ?? "";
  const note = /2 fonctionnalités en cours pour une limite de 1/;
  await waitFor(async () => expect(within(await column("S45 Correctifs")).getByText(note)).toBeTruthy());
  expect(within(await column(/^S42 /)).queryByText(note)).toBeNull();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Fonctionnalité" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByLabelText<HTMLSelectElement>("Sprint").value).toBe(late);
});
