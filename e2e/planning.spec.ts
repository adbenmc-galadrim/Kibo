import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { SILO_FEATURES, SILO_LOOSE_TICKETS } from "./fixtures/silo-maquettes";
import { PIXEL_WIDTH } from "./pixel-settings";
import {
  attachRepo,
  createBranch,
  dragOnto,
  kiboCli,
  loadSilo,
  moveToSprint,
  type Silo,
  setStatus,
} from "./planning-kit";

const EXECUTION = "Exécution des agents dans Kibo";
const BRANCH = "feat/silo-51-lecture-excel";

test.describe.configure({ mode: "serial" });

let silo: Silo;

const S43_TITLES = [
  ...SILO_FEATURES.filter((f) => f.sprint === "S43").flatMap((f) => f.steps.map((step) => step.title)),
  ...SILO_LOOSE_TICKETS.filter((t) => t.sprint === "S43").map((t) => t.title),
].sort();

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: 1000 });
  await pairBrowser(page);
  silo = await loadSilo(page);
});

const column = (page: Page, name: string) => page.getByRole("region", { name });
const card = (page: Page, shortKey: string) =>
  page.getByRole("button", { name: new RegExp(`^${shortKey} `) });

async function openPlanning(page: Page, s42 = "S42 Saisie hors ligne"): Promise<void> {
  await page.goto(silo.pageUrl("planning@1.0.0"));
  await expect(column(page, s42)).toBeVisible();
}

const ADD_BUTTONS = { "Nouveau sprint": "Sprint", "Nouvelle fonctionnalité": "Fonctionnalité" } as const;

async function addFromHeader(page: Page, dialog: keyof typeof ADD_BUTTONS) {
  await page.getByRole("button", { name: ADD_BUTTONS[dialog], exact: true }).click();
  return page.getByRole("dialog", { name: dialog });
}

type Fit = {
  page: number;
  content: number;
  topBar: number;
  header: number;
  overlap: number;
  chipLines: number[];
};

const LINE_HEIGHT = 15;

function measureFit(): Fit {
  const overflow = (el: Element | null) => (el instanceof HTMLElement ? el.scrollWidth - el.clientWidth : 0);
  const body = document.querySelector("[data-view-body]");
  const heading = body?.querySelector("header");
  const header = heading?.getBoundingClientRect();
  const title = heading?.querySelector("h1")?.getBoundingClientRect();
  const actions = heading?.lastElementChild?.getBoundingClientRect();
  const sameLine = title && actions && title.bottom > actions.top && actions.bottom > title.top;
  const lines = (chip: Element) => {
    const range = document.createRange();
    range.selectNodeContents(chip);
    return range.getBoundingClientRect().height;
  };
  return {
    page: document.documentElement.scrollWidth - innerWidth,
    content: overflow(body?.parentElement ?? null),
    topBar: overflow(document.querySelector("header.k-top")),
    header: (header?.right ?? 0) - (body?.getBoundingClientRect().right ?? 0),
    overlap: sameLine ? title.right - actions.left : 0,
    chipLines: Array.from(body?.querySelectorAll("[data-feature] span") ?? [])
      .filter((s) => s.textContent?.startsWith("bloquée ·"))
      .map(lines),
  };
}

async function expectFits(page: Page, layout: "Colonnes" | "Bandes"): Promise<void> {
  await page.getByRole("button", { name: layout, exact: true }).click();
  await expect(page.getByRole("button", { name: layout, exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const fit = await page.evaluate(measureFit);
  expect({ page: fit.page, content: fit.content, topBar: fit.topBar }).toEqual({
    page: 0,
    content: 0,
    topBar: 0,
  });
  expect(fit.header).toBeLessThanOrEqual(0);
  expect(fit.overlap).toBeLessThanOrEqual(0);
  if (layout === "Bandes") expect(fit.chipLines.length).toBeGreaterThan(0);
  for (const height of fit.chipLines) expect(height).toBeLessThan(LINE_HEIGHT * 1.5);
}

test("the Planning holds in the window in Columns and Bands, its blocked chips on one line, the agent over it under 1180 px", async ({
  page,
}) => {
  const f6Sprint = await moveToSprint(page, silo, "F6", null);
  try {
    for (const size of [
      { width: 1000, height: 800 },
      { width: 1440, height: 900 },
    ]) {
      await page.setViewportSize(size);
      await openPlanning(page);
      await expectFits(page, "Bandes");
      await expectFits(page, "Colonnes");
      const before = await page.locator("[data-view-body]").boundingBox();
      await page.getByRole("button", { name: /^Agent de projet/ }).click();
      const overlay = size.width < 1180;
      await expect(page.locator("[data-overlay]")).toHaveAttribute("data-overlay", String(overlay));
      if (overlay) expect(await page.locator("[data-view-body]").boundingBox()).toEqual(before);
      else {
        await expectFits(page, "Bandes");
        await expectFits(page, "Colonnes");
      }
      const close = overlay ? "Fermer le panneau" : /^Agent de projet/;
      await page.getByRole("button", { name: close }).click();
      await expect(page.locator("[data-overlay]")).toHaveCount(0);
    }
  } finally {
    await page.getByRole("button", { name: "Colonnes", exact: true }).click();
    await moveToSprint(page, silo, "F6", f6Sprint);
  }
});

test("dragging F9 onto S44 plans it, and the CLI lists it in S44", async ({ page }, info) => {
  await openPlanning(page);
  const s44 = column(page, "S44 Rapports");
  await dragOnto(page, card(page, "F9"), s44, page.getByText("Déposer pour planifier en S44"));
  await expect(s44.getByRole("button", { name: /^F9 / })).toBeVisible();
  await expect
    .poll(() => {
      const sprints: unknown = JSON.parse(kiboCli(info, ["sprints", "list", "--project", "SILO", "--json"]));
      return Array.isArray(sprints) ? sprints.find((s) => s.code === "S44")?.features : undefined;
    })
    .toEqual(expect.arrayContaining(["SILO-90"]));
});

test("a new sprint S45 and a new feature F10 with three steps show in the Planning", async ({ page }) => {
  await openPlanning(page);
  const sprint = await addFromHeader(page, "Nouveau sprint");
  await sprint.getByLabel("Code").fill("S45");
  await sprint.getByLabel("Nom").fill("Exports");
  await sprint.getByLabel("Début").fill("2026-11-02");
  await sprint.getByLabel("Fin").fill("2026-11-06");
  await sprint.getByRole("button", { name: "Créer le sprint" }).click();
  await expect(column(page, "S45 Exports")).toBeVisible();
  const feature = await addFromHeader(page, "Nouvelle fonctionnalité");
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
  await expect(page.getByText("En cours : 2 / 2")).toBeVisible();
  await setStatus(page, silo, "SILO-81", "in_progress");
  await expect(page.getByText("En cours : 3 / 2")).toBeVisible();
});

test("the sheet of F5 names why its next step cannot start, with nothing to copy", async ({ page }) => {
  await page.goto(silo.ticketUrl("SILO-30"));
  await expect(page.getByText("Prochaine étape SILO-34 : attend SILO-33.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copier la commande" })).toHaveCount(0);
});

test("the sheet of S42 opens from its Tickets tab and its Planning name; the pencil edits it", async ({
  page,
}) => {
  await page.goto(silo.pageUrl("tickets@1.0.0"));
  const s42 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S42$/ });
  await s42.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Fiche du sprint" }).click();
  const sheet = page.getByRole("dialog", { name: /S42 · Saisie hors ligne/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("list", { name: "Fonctionnalités du sprint" })).toContainText("F4");
  await sheet.getByRole("button", { name: "Modifier" }).click();
  const dialog = page.getByRole("dialog", { name: "Modifier le sprint S42" });
  await expect(dialog.getByLabel("Nom")).toHaveValue("Saisie hors ligne");
  await dialog.getByLabel("Nom").fill("Saisie sans réseau");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("dialog", { name: /S42 · Saisie sans réseau/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await openPlanning(page, "S42 Saisie sans réseau");
  const header = column(page, "S42 Saisie sans réseau");
  await header.getByRole("button", { name: "Fiche du sprint S42 Saisie sans réseau" }).click();
  const fromPlanning = page.getByRole("dialog", { name: /S42 · Saisie sans réseau/ });
  await expect(fromPlanning.getByRole("list", { name: "Fonctionnalités du sprint" })).toContainText("F4");
  await expect(page.getByRole("dialog", { name: "Modifier le sprint S42" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(fromPlanning).toBeHidden();
  await header.getByRole("button", { name: "Modifier le sprint", exact: true }).click();
  const back = page.getByRole("dialog", { name: "Modifier le sprint S42" });
  await back.getByLabel("Nom").fill("Saisie hors ligne");
  await back.getByRole("button", { name: "Enregistrer" }).click();
  await expect(column(page, "S42 Saisie hors ligne")).toBeVisible();
});

test("the agent execution setting is gone and Agents and the agent bar never show", async ({ page }) => {
  await page.goto("/#/settings/general");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("switch", { name: EXECUTION })).toHaveCount(0);
  await openPlanning(page);
  await expect(page.getByRole("button", { name: "Agents", exact: true })).toBeHidden();
  await expect(page.getByRole("region", { name: "Agents", exact: true })).toBeHidden();
});

test("the S43 tab of Tickets has nothing delivered, and a new branch puts SILO-51 In progress", async ({
  page,
}) => {
  await page.goto(silo.pageUrl("tickets@1.0.0"));
  const s43 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S43$/ });
  await s43.click();
  await expect(s43).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Lecture du fichier Excel")).toBeVisible();
  const titles = page.locator("[data-row-title]");
  await expect(titles).toHaveCount(S43_TITLES.length);
  expect((await titles.allTextContents()).sort()).toEqual(S43_TITLES);
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeHidden();
  await expect(page.getByText(/^Terminés/)).toHaveCount(0);
  const repo = await attachRepo(page, silo);
  try {
    createBranch(repo, BRANCH);
    const row = page.getByRole("listitem").filter({ has: page.getByText("SILO-51", { exact: true }) });
    await expect(row).toContainText("En cours", { timeout: 20_000 });
    await expect(row).toContainText(BRANCH);
  } finally {
    repo.remove();
  }
});
