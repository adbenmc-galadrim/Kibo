import { expect, test } from "bun:test";
import type { CiRun } from "@kibo/schema";
import { SdkProvider } from "@kibo/sdk";
import { createMockSdk } from "@kibo/sdk/mock";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fr } from "./fr";
import { Component, manifest } from "./index";
import { TODAY, trackingSeed } from "./test-seed";

const ci = (ticketKey: string, conclusion: string): CiRun => ({
  repo: "galadrim/emis",
  runId: 1,
  prNumber: 22,
  ticketKey,
  headSha: "abc",
  workflow: "ci",
  status: "completed",
  conclusion,
  url: "https://github.com/galadrim/emis/actions/runs/1",
  startedAt: null,
  updatedAt: "2026-10-16T12:00:00Z",
  jobs: [],
});

const setup = () => {
  const m = createMockSdk(manifest, {
    seed: trackingSeed(Date.now()),
    today: TODAY,
    surface: "view",
    format: "full",
    ciRuns: [ci("KIB-13", "success")],
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  return m;
};

const rowOf = async (key: string) => {
  const found = (await screen.findByText(key)).closest("li");
  if (!(found instanceof HTMLElement)) throw new Error(`no row ${key}`);
  return found;
};
const cell = (row: HTMLElement, name: string) => row.querySelector(`[data-cell=${name}]`)?.textContent;
const rowKeys = (inSection: boolean) =>
  Array.from(document.querySelectorAll("[data-selected]"))
    .filter((r) => (r.closest("li")?.parentElement?.closest("li") !== null) === inSection)
    .map((r) => r.querySelector("span")?.textContent);
const keysShown = () => rowKeys(false);

test("P4: title, sprint summary, columns, and the footer that says states come from git", async () => {
  setup();
  expect(await screen.findByRole("heading", { name: "Tickets" })).toBeTruthy();
  expect(await screen.findByText("sprint S42 · 12 tickets dans 3 fonctionnalités")).toBeTruthy();
  const header = screen.getByText("Git et PR").parentElement ?? document.body;
  expect(Array.from(header.children, (c) => c.textContent)).toEqual([
    "Clé",
    "Titre",
    "Fonctionnalité",
    "État",
    "Git et PR",
    "Livraison",
    "Mis à jour",
  ]);
  expect(screen.getByText(fr.footer)).toBeTruthy();
  expect(fr.footer).toBe(
    "États tirés de git : branche créée ⇒ En cours, PR ouverte ⇒ En review, PR fusionnée ⇒ Terminé. Étapes posées par kibo tickets step.",
  );
});

test("open steps come first by recent activity, with their feature, state, git, delivery and age", async () => {
  setup();
  const row = await rowOf("KIB-14");
  expect(keysShown()).toEqual(["KIB-14", "KIB-9", "KIB-13", "KIB-10", "KIB-15"]);
  expect(
    within(row).getByRole("button", {
      name: "Ouvrir la fonctionnalité F3 · Envoyer les photos d'un tronçon",
    }),
  ).toBeTruthy();
  expect(cell(row, "status")).toBe("En cours");
  expect(cell(row, "git")).toBe("feat/envoi-hors-ligne");
  expect(cell(row, "delivery")).toBe("7 · Porte qualité");
  expect(cell(row, "updated")).toBe("il y a 9 min");
  const review = await rowOf("KIB-13");
  expect(cell(review, "git")).toBe("#22");
  expect(within(review).getByRole("img", { name: "CI réussie" })).toBeTruthy();
  const waiting = await rowOf("KIB-15");
  expect(cell(waiting, "git")).toBe("attend KIB-14");
  expect(cell(waiting, "delivery")).toBe("—");
  expect(cell(waiting, "updated")).toBe("—");
});

test("Terminés dans S42 shows its 4 most recent, the count shows them all, the header folds it", async () => {
  const m = setup();
  await rowOf("KIB-14");
  expect(rowKeys(true)).toEqual(["KIB-5", "KIB-12", "KIB-8", "KIB-7"]);
  const merged = await rowOf("KIB-5");
  expect(cell(merged, "git")).toBe("#18fusionnée");
  expect(cell(merged, "delivery")).toBe("11 · Livré");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Afficher les 7 terminés" }));
  expect(rowKeys(true)).toEqual(["KIB-5", "KIB-12", "KIB-8", "KIB-7", "KIB-2", "KIB-3", "KIB-4"]);
  await user.click(screen.getByRole("button", { name: "Afficher les 4 plus récents" }));
  expect(rowKeys(true)).toHaveLength(4);
  await user.click(screen.getByRole("button", { name: "Replier Terminés dans S42" }));
  expect(rowKeys(true)).toEqual([]);
  expect(screen.getByRole("button", { name: "Déplier Terminés dans S42" }).textContent).toBe(
    "Terminés dans S42",
  );
  expect(m.configPatches).toEqual([{ doneOpen: false }]);
});

test("a folded choice is remembered by the instance; Hors fonctionnalité opens on click", async () => {
  const m = createMockSdk(manifest, {
    seed: trackingSeed(Date.now()),
    today: TODAY,
    config: { doneOpen: false },
  });
  render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  await rowOf("KIB-14");
  expect(rowKeys(true)).toEqual([]);
  expect(screen.getByRole("button", { name: "Déplier Terminés dans S42" })).toBeTruthy();
  await userEvent.setup().click(screen.getByRole("button", { name: "Déplier Hors fonctionnalité" }));
  const loose = await rowOf("KIB-16");
  expect(within(loose).queryByRole("button", { name: /^Ouvrir la fonctionnalité/ })).toBeNull();
});

test("the feature chip opens the feature", async () => {
  const m = setup();
  const row = await rowOf("KIB-14");
  fireEvent.click(within(row).getByRole("button", { name: /^Ouvrir la fonctionnalité F3/ }));
  expect(m.opened).toEqual([m.snapshot().tickets.find((t) => t.keyLabel === "KIB-11")?.id ?? ""]);
});

test("Ouverts hides the done tickets, Fonctionnalité keeps one feature, the sort can follow the keys", async () => {
  const m = setup();
  await rowOf("KIB-14");
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Ouverts" }));
  await user.click(await screen.findByRole("menuitemcheckbox", { name: "Ouverts seulement" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("button", { name: /Terminés dans S42$/ })).toBeNull();
  expect(screen.getByRole("button", { name: "Ouverts" }).getAttribute("aria-pressed")).toBe("true");
  await user.click(screen.getByRole("button", { name: "Ouverts" }));
  await user.click(await screen.findByRole("menuitem", { name: "Effacer les filtres" }));
  await user.click(screen.getByRole("button", { name: "Fonctionnalité" }));
  expect((await screen.findAllByRole("menuitemradio")).map((i) => i.textContent)).toEqual([
    "Toutes les fonctionnalités",
    "F1 · Réaffecter un ISO",
    "F2 · Saisir un tronçon hors ligne",
    "F3 · Envoyer les photos d'un tronçon",
  ]);
  await user.click(screen.getByRole("menuitemradio", { name: "F2 · Saisir un tronçon hors ligne" }));
  expect(keysShown()).toEqual(["KIB-9", "KIB-10"]);
  expect(screen.getByRole("button", { name: "F2" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("button", { name: "Déplier Hors fonctionnalité" })).toBeNull();
  await user.click(screen.getByRole("button", { name: "F2" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Toutes les fonctionnalités" }));
  await user.click(screen.getByRole("button", { name: "Activité récente" }));
  await user.click(await screen.findByRole("menuitemradio", { name: "Clé" }));
  expect(keysShown()).toEqual(["KIB-9", "KIB-10", "KIB-13", "KIB-14", "KIB-15"]);
  expect(m.violations).toEqual([]);
});

test("a live run puts an orange dot after the title", async () => {
  const m = setup();
  const row = await rowOf("KIB-14");
  expect(within(row).queryByRole("img", { name: "Agent en cours" })).toBeNull();
  const id = m.snapshot().tickets.find((t) => t.keyLabel === "KIB-14")?.id ?? "";
  act(() =>
    m.setRuns([{ ticketId: id, runId: "r1", label: "opus-dev-2", state: "running", position: null }]),
  );
  expect(await within(row).findByRole("img", { name: "Agent en cours" })).toBeTruthy();
});

test("a narrow widget keeps key and title, the other cells appear with the width", async () => {
  const m = createMockSdk(manifest, { seed: trackingSeed(Date.now()), today: TODAY, format: "medium" });
  const { container } = render(
    <SdkProvider sdk={m.sdk}>
      <Component />
    </SdkProvider>,
  );
  const row = await rowOf("KIB-14");
  expect(container.querySelector("section")?.className).toContain("@container");
  expect(screen.queryByRole("heading", { name: "Tickets" })).toBeNull();
  const classes = (name: string) => row.querySelector(`[data-cell=${name}]`)?.className.split(" ") ?? [];
  const shownFrom: [string, string][] = [
    ["status", "@xl:flex"],
    ["git", "@3xl:flex"],
    ["delivery", "@5xl:flex"],
    ["updated", "@5xl:flex"],
  ];
  for (const [name, from] of shownFrom)
    expect(classes(name)).toEqual(expect.arrayContaining(["hidden", from]));
});
