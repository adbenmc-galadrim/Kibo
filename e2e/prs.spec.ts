import { expect, type Locator, type Page, test } from "@playwright/test";
import { pairBrowser, rpc, text } from "./agents-seed";
import { SILO_PRS_RAIL, SILO_PRS_STACKS } from "./fixtures/silo-prs";
import { screensDir } from "./pixel-screen";
import { siloPageUrl } from "./pixel-silo";
import { loadSilo } from "./planning-kit";
import {
  addGraphPage,
  deleteGraphPage,
  PRS_SCREENS_DIR,
  prCard,
  prRefOf,
  prsCanvas,
  prsCounter,
  showPrs,
  viewRadio,
} from "./prs-kit";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 1000 } });

const SHOTS = screensDir(PRS_SCREENS_DIR);
const scheme = (): string => test.info().project.name.replace("prs-", "");
const shot = (page: Page, name: string) =>
  page.screenshot({ path: `${SHOTS}/prs-${name}-${scheme()}.png`, animations: "disabled" });

const prNumbers = (scope: Locator): Promise<number[]> =>
  scope.locator("[data-pr]").evaluateAll((cards) => cards.map((c) => Number(c.getAttribute("data-pr"))));

async function openSiloGraph(page: Page): Promise<void> {
  await pairBrowser(page);
  await page.goto(await siloPageUrl(page, "Graphe"));
  await expect(page.getByRole("radiogroup", { name: "Vue" })).toBeVisible();
}

async function openSiloPrs(page: Page): Promise<void> {
  await openSiloGraph(page);
  await showPrs(page);
}

test("the Silo Graphe opens on the features, then shows the stacked pull requests", async ({ page }) => {
  await pairBrowser(page);
  const silo = await loadSilo(page);
  expect(await prRefOf(page, silo, 33, 24)).toMatchObject({
    state: "draft",
    base: "feat/silo-32",
    head: "feat/envoi-hors-ligne",
  });
  await openSiloGraph(page);
  await expect(viewRadio(page, "Fonctionnalités")).toBeChecked();
  await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();

  await showPrs(page);
  const canvas = prsCanvas(page);
  const stacks = canvas.getByRole("group");
  await expect(stacks).toHaveCount(SILO_PRS_STACKS.length);
  await expect(stacks.nth(0)).toHaveAccessibleName(/^3 PR empilées · .* · #22 à #25$/);
  await expect(stacks.nth(1)).toHaveAccessibleName(/^1 PR · .* · #20$/);
  await expect(stacks.nth(2)).toHaveAccessibleName("1 PR · Hors fonctionnalité · #23");
  expect(await prNumbers(canvas)).toEqual(SILO_PRS_STACKS.flat());
  for (const [i, numbers] of SILO_PRS_STACKS.entries())
    expect(await prNumbers(stacks.nth(i))).toEqual([...numbers]);
  await expect(stacks.nth(0).getByText(/^sur /)).toHaveText([
    "sur feat/silo-32",
    "sur feat/envoi-hors-ligne",
  ]);
  await expect(stacks.nth(1).getByText(/^sur /)).toHaveCount(0);
  await expect(stacks.nth(2).getByText(/^sur /)).toHaveCount(0);
  await expect(canvas.getByText(SILO_PRS_RAIL, { exact: true })).toBeVisible();
  await expect(canvas.getByText("branche de base", { exact: true })).toBeVisible();
  await shot(page, "piles");
});

test("the view is remembered after a reload, per Graphe instance", async ({ page }) => {
  await openSiloPrs(page);
  await page.reload();
  await expect(viewRadio(page, "PRs")).toBeChecked();
  await expect(prsCounter(page)).toBeVisible();

  const silo = await loadSilo(page);
  const other = await addGraphPage(page, silo.projectId, "Graphe bis");
  try {
    await page.goto(other.url);
    await expect(viewRadio(page, "Fonctionnalités")).toBeChecked();
    await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();
  } finally {
    await deleteGraphPage(page, other);
  }
});

test("a click on a pull request opens the sheet of its ticket", async ({ page }) => {
  await openSiloPrs(page);
  await prCard(page, 25).click();
  const sheet = page.getByRole("dialog", { name: /Tests E2E de l'envoi/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("SILO-34", { exact: true }).first()).toBeVisible();
  await shot(page, "fiche");
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(prsCounter(page)).toBeVisible();
});

test("the arrows move between the pull requests and Enter opens the ticket", async ({ page }) => {
  await openSiloPrs(page);
  await prCard(page, 22).focus();
  const moves: [string, number][] = [
    ["ArrowUp", 24],
    ["ArrowUp", 25],
    ["ArrowUp", 25],
    ["ArrowDown", 24],
    ["ArrowDown", 22],
    ["ArrowRight", 20],
    ["ArrowRight", 23],
    ["ArrowRight", 23],
    ["ArrowLeft", 20],
  ];
  for (const [key, number] of moves) {
    await page.keyboard.press(key);
    await expect(prCard(page, number)).toBeFocused();
  }
  await page.keyboard.press("Enter");
  const sheet = page.getByRole("dialog", { name: /Conflits de saisie/ });
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
});

test("a project without pull request shows the empty state", async ({ page }) => {
  await pairBrowser(page);
  const created = await rpc(page, {
    method: "createProject",
    name: "Essai sans PR",
    key: "ESS",
    folder: null,
    color: "#F97316",
  });
  const projectId = text(created, "id");
  try {
    const graph = await addGraphPage(page, projectId, "Graphe");
    await page.goto(graph.url);
    await expect(viewRadio(page, "Fonctionnalités")).toBeChecked();
    await viewRadio(page, "PRs").click();
    await expect(page.getByText("0 PR ouverte · 0 pile", { exact: true })).toBeVisible();
    await expect(page.getByText("Aucune PR ouverte", { exact: true })).toBeVisible();
    await expect(
      page.getByText("Les PR ouvertes des étapes apparaissent ici, empilées sur leur branche de base."),
    ).toBeVisible();
    await expect(prsCanvas(page).getByRole("group")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Légende" })).toHaveCount(0);
    await shot(page, "vide");
  } finally {
    await rpc(page, { method: "deleteProject", projectId });
  }
});
