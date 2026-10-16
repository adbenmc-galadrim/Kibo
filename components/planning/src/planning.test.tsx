import { afterEach, beforeEach, expect, setSystemTime, test } from "bun:test";
import { LAZY_FALLBACK_SELECTOR, SdkProvider } from "@kibo/sdk";
import { runConformance } from "@kibo/sdk/conformance";
import { createMockSdk } from "@kibo/sdk/mock";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Component, manifest, planningPanel } from "./index";
import { cardIn, column, setupPlanning } from "./planning-kit";
import { seed, TODAY } from "./test-seed";

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
  expect(within(s42).getByText("en cours")).toBeTruthy();
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
  expect(within(await cardIn(/^S42 /, "F4")).getByText("ouverte")).toBeTruthy();
  expect(within(await cardIn(/^S42 /, "F3")).getByText("livrée")).toBeTruthy();
});

test("a late feature is outlined in red with a warning under its sprint", async () => {
  setupPlanning();
  const f5 = await cardIn(/^S42 /, "F5");
  expect(within(f5).getByText("en retard")).toBeTruthy();
  const stroke = f5.querySelector("[data-slot=penpot-stroke] rect");
  expect(stroke?.getAttribute("stroke")).toBe("var(--tracking-red)");
  expect((await cardIn(/^S42 /, "F4")).querySelector("[data-slot=penpot-stroke]")).toBeNull();
  expect(within(await column(/^S42 /)).getByText("F5 ne tiendra pas : 4 étapes restantes")).toBeTruthy();
});

test("open features against the limit: a warning, nothing disabled", async () => {
  setupPlanning();
  const badge = await screen.findByRole("button", { name: /Ouvertes : 2 \/ 2/ });
  expect(badge.getAttribute("data-over")).toBe("false");
  expect(screen.getByRole("button", { name: "Ajouter" }).hasAttribute("disabled")).toBe(false);
});

test("the open limit is the project's tracking setting, updated live", async () => {
  const { m } = setupPlanning(TODAY, { tracking: { openLimit: 3 } });
  expect(await screen.findByRole("button", { name: /Ouvertes : 2 \/ 3/ })).toBeTruthy();
  m.setTracking({ openLimit: 1 });
  const badge = await screen.findByRole("button", { name: /Ouvertes : 2 \/ 1/ });
  expect(badge.getAttribute("data-over")).toBe("true");
});

test("the open badge turns amber with a note above the limit, and lists the open features", async () => {
  const { m, seeded } = setupPlanning();
  const [first] = seeded.features.f7.steps;
  if (!first) throw new Error("step missing");
  m.run({ method: "setStatus", ticketId: first.id, statusId: "in_progress" });
  const badge = await screen.findByRole("button", { name: /Ouvertes : 3 \/ 2/ });
  expect(badge.getAttribute("data-over")).toBe("true");
  expect(
    within(await column(/^S42 /)).getByText(/3 fonctionnalités ouvertes pour une limite de 2/),
  ).toBeTruthy();
  await userEvent.setup().click(badge);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByText("Rapport de chantier journalier")).toBeTruthy();
});

test("the bands layout is announced for phase 26 and disabled", async () => {
  setupPlanning();
  const bands = await screen.findByRole("button", { name: "Bandes" });
  expect(bands.hasAttribute("disabled")).toBe(true);
  expect(bands.parentElement?.getAttribute("title")).toBe("Phase 26");
  expect(screen.getByRole("button", { name: "Colonnes" }).getAttribute("aria-pressed")).toBe("true");
});

test("clicking a feature title opens its sheet", async () => {
  const { m, seeded } = setupPlanning();
  await userEvent.setup().click(await screen.findByRole("button", { name: "Exporter le dossier client" }));
  await waitFor(() => expect(m.opened).toEqual([seeded.features.f9.root.id]));
});
