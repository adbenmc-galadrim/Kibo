import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { EMIS_FEATURES, EMIS_LOOSE_TICKETS } from "./fixtures/emis-maquettes";
import { PIXEL_WIDTH } from "./pixel-settings";
import {
  attachRepo,
  clipboardText,
  createBranch,
  dragOnto,
  type Emis,
  kiboCli,
  loadEmis,
  setStatus,
} from "./planning-kit";

const EXECUTION = "Exécution des agents dans Kibo";
const BRANCH = "feat/emis-51-lecture-excel";

test.describe.configure({ mode: "serial" });

let emis: Emis;

const S43_TITLES = [
  ...EMIS_FEATURES.filter((f) => f.sprint === "S43").flatMap((f) => f.steps.map((step) => step.title)),
  ...EMIS_LOOSE_TICKETS.filter((t) => t.sprint === "S43").map((t) => t.title),
].sort();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: 1000 });
  await pairBrowser(page);
  emis = await loadEmis(page);
});

const column = (page: Page, name: string) => page.getByRole("region", { name });
const card = (page: Page, shortKey: string) =>
  page.getByRole("button", { name: new RegExp(`^${shortKey} `) });

async function openPlanning(page: Page, s42 = "S42 Terrain hors ligne"): Promise<void> {
  await page.goto(emis.pageUrl("planning@1.0.0"));
  await expect(column(page, s42)).toBeVisible();
}

async function addFromMenu(page: Page, item: string) {
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  await page.getByRole("menuitem", { name: item }).click();
  return page.getByRole("dialog", { name: item });
}

test("dragging F9 onto S44 plans it, and the CLI lists it in S44", async ({ page }, info) => {
  await openPlanning(page);
  const s44 = column(page, "S44 Rapports");
  await dragOnto(page, card(page, "F9"), s44, page.getByText("Déposer pour planifier en S44"));
  await expect(s44.getByRole("button", { name: /^F9 / })).toBeVisible();
  await expect
    .poll(() => {
      const sprints: unknown = JSON.parse(kiboCli(info, ["sprints", "list", "--project", "EMIS", "--json"]));
      return Array.isArray(sprints) ? sprints.find((s) => s.code === "S44")?.features : undefined;
    })
    .toEqual(expect.arrayContaining(["EMIS-90"]));
});

test("a new sprint S45 and a new feature F10 with three steps show in the Planning", async ({ page }) => {
  await openPlanning(page);
  const sprint = await addFromMenu(page, "Nouveau sprint");
  await sprint.getByLabel("Code").fill("S45");
  await sprint.getByLabel("Nom").fill("Exports");
  await sprint.getByLabel("Début").fill("2026-11-02");
  await sprint.getByLabel("Fin").fill("2026-11-06");
  await sprint.getByRole("button", { name: "Créer le sprint" }).click();
  await expect(column(page, "S45 Exports")).toBeVisible();
  const feature = await addFromMenu(page, "Nouvelle fonctionnalité");
  await feature.getByLabel("Nom").fill("Signer un PV");
  await feature.getByLabel("Sprint").selectOption({ label: "S45 Exports" });
  await feature.getByLabel("Étapes, une par ligne").fill("Écran de signature\nExport PDF\nDémo client");
  await feature.getByRole("button", { name: "Créer la fonctionnalité" }).click();
  const f10 = column(page, "S45 Exports").getByRole("button", { name: /^F10 Signer un PV/ });
  await expect(f10).toBeVisible();
  await expect(f10).toContainText("0/3 étapes");
});

test("starting a step of F7 opens a third feature and the limit warns", async ({ page }) => {
  await openPlanning(page);
  await expect(page.getByText("Ouvertes : 2 / 2")).toBeVisible();
  await setStatus(page, emis, "EMIS-81", "in_progress");
  await expect(page.getByText("Ouvertes : 3 / 2")).toBeVisible();
});

test("the sheet of F5 copies the command of its next step", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(emis.ticketUrl("EMIS-30"));
  await page.getByRole("button", { name: "Livrer la prochaine étape" }).click();
  await expect(page.getByText("Commande copiée")).toBeAttached();
  expect(await clipboardText(page)).toBe("/full-delivery EMIS-34");
});

test("the sheet of S42 opens from its Tickets tab and its Planning name; the pencil edits it", async ({
  page,
}) => {
  await page.goto(emis.pageUrl("tickets@1.0.0"));
  const s42 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S42$/ });
  await s42.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Fiche du sprint" }).click();
  const sheet = page.getByRole("dialog", { name: /S42 · Terrain hors ligne/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("list", { name: "Fonctionnalités du sprint" })).toContainText("F4");
  await sheet.getByRole("button", { name: "Modifier" }).click();
  const dialog = page.getByRole("dialog", { name: "Modifier le sprint S42" });
  await expect(dialog.getByLabel("Nom")).toHaveValue("Terrain hors ligne");
  await dialog.getByLabel("Nom").fill("Terrain sans réseau");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog", { name: /S42 · Terrain sans réseau/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await openPlanning(page, "S42 Terrain sans réseau");
  const header = column(page, "S42 Terrain sans réseau");
  await header.getByRole("button", { name: "Fiche du sprint S42 Terrain sans réseau" }).click();
  const fromPlanning = page.getByRole("dialog", { name: /S42 · Terrain sans réseau/ });
  await expect(fromPlanning.getByRole("list", { name: "Fonctionnalités du sprint" })).toContainText("F4");
  await expect(page.getByRole("dialog", { name: "Modifier le sprint S42" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(fromPlanning).toBeHidden();
  await header.getByRole("button", { name: "Modifier le sprint", exact: true }).click();
  const back = page.getByRole("dialog", { name: "Modifier le sprint S42" });
  await back.getByLabel("Nom").fill("Terrain hors ligne");
  await back.getByRole("button", { name: "Enregistrer" }).click();
  await expect(column(page, "S42 Terrain hors ligne")).toBeVisible();
});

test("the agent execution setting shows, then hides, Agents and the agent bar", async ({ page }) => {
  const agents = page.getByRole("button", { name: "Agents", exact: true });
  const bar = page.getByRole("region", { name: "Agents", exact: true });
  const toggle = async (checked: boolean) => {
    await page.goto("/#/settings/general");
    const execution = page.getByRole("switch", { name: EXECUTION });
    await expect(execution).toHaveAttribute("aria-checked", String(!checked));
    await execution.click();
    await expect(execution).toHaveAttribute("aria-checked", String(checked));
    await openPlanning(page);
  };
  await openPlanning(page);
  await expect(agents).toBeHidden();
  await toggle(true);
  await expect(agents).toBeVisible();
  await expect(bar).toBeVisible();
  await toggle(false);
  await expect(agents).toBeHidden();
  await expect(bar).toBeHidden();
});

test("the S43 tab of Tickets has nothing delivered, and a new branch puts EMIS-51 In progress", async ({
  page,
}) => {
  await page.goto(emis.pageUrl("tickets@1.0.0"));
  const s43 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S43$/ });
  await s43.click();
  await expect(s43).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Lecture du fichier Excel")).toBeVisible();
  const titles = page.locator("[data-row-title]");
  await expect(titles).toHaveCount(S43_TITLES.length);
  expect((await titles.allTextContents()).sort()).toEqual(S43_TITLES);
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeHidden();
  await expect(page.getByText(/^Terminés/)).toHaveCount(0);
  const repo = await attachRepo(page, emis);
  try {
    createBranch(repo, BRANCH);
    const row = page.getByRole("listitem").filter({ has: page.getByText("EMIS-51", { exact: true }) });
    await expect(row).toContainText("En cours", { timeout: 20_000 });
    await expect(row).toContainText(BRANCH);
  } finally {
    repo.remove();
  }
});
