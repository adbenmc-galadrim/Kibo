import { rmSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { createGitRepo, type Seeded, seedWorkspace } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const cleanups: (() => void)[] = [];
test.afterAll(async () => {
  for (const cleanup of cleanups.splice(0)) await expect(() => cleanup()).toPass();
});

let seeded: Seeded | null = null;

async function pair(page: Page) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Accueil" })).toBeVisible();
  await page.goto("/#/");
}

async function seed(page: Page): Promise<Seeded> {
  if (seeded) return seeded;
  const folder = createGitRepo();
  cleanups.push(() => rmSync(folder, { recursive: true, force: true }));
  seeded = await seedWorkspace(page, folder);
  return seeded;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box;
}

async function dragBelow(page: Page, source: Locator, key: string, target: Locator) {
  const label = await boxOf(source.getByText(key, { exact: true }));
  const to = await boxOf(target);
  const grip = { x: label.x + label.width / 2, y: label.y + label.height / 2 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 12 });
  await page.mouse.up();
}

test("synchronisation : état vide et connexion d'un autre appareil", async ({ page }, info) => {
  await pair(page);
  await page.goto("/#/settings/sync");
  await expect(page.getByText("Partage tes projets entre tes appareils et avec ton équipe.")).toBeVisible();
  await expect(page.getByText("Se connecter à un serveur")).toBeVisible();
  await expect(page.getByText("C'est mon autre appareil")).toBeVisible();
  await shot(page, info, "ecran-119");
  await page.getByRole("button", { name: "Entrer le code" }).click();
  const dialog = page.getByRole("dialog", { name: "Se connecter à un serveur" });
  await expect(dialog.getByLabel("Adresse du serveur")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Options avancées" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await shot(page, info, "ecran-120");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("Kanban filtré et réordonné", async ({ page }, info) => {
  await pair(page);
  const { projectId, board } = await seed(page);
  await page.goto(`/#/p/${projectId}/${encodeURIComponent(board)}`);
  const filter = page.getByRole("group", { name: "Tickets affichés" });
  await expect(filter.getByRole("button", { name: "Tous", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByText("17 tickets · Tous", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Nouveau ticket dans Bloqué" }).click();
  const create = page.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(create.getByLabel("Motif")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(create).toBeHidden();

  const todo = page.getByRole("region", { name: "À faire" });
  const keys = () =>
    todo.getByRole("article").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-key")));
  await expect.poll(keys).toHaveLength(4);
  const before = await keys();
  const moved = before.filter((key) => key !== "KIB-15");
  moved.splice(moved.indexOf("KIB-18") + 1, 0, "KIB-15");
  expect(moved).not.toEqual(before);
  await dragBelow(
    page,
    todo.getByRole("article", { name: /^KIB-15 / }),
    "KIB-15",
    todo.getByRole("article", { name: /^KIB-18 / }),
  );
  await expect.poll(keys).toEqual(moved);
  await shot(page, info, "ecran-126");
  await page.reload();
  await expect.poll(keys).toEqual(moved);
});
