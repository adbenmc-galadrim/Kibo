import { expect, type Page, test } from "@playwright/test";
import { APP_VERSION } from "./app-version";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const SEEN_KEY = "kibo.whatsNew.seenVersion";

async function seedOlderVersionOnce(page: Page) {
  await page.addInitScript((key) => {
    if (sessionStorage.getItem("e2e.seeded")) return;
    sessionStorage.setItem("e2e.seeded", "1");
    localStorage.setItem(key, "0.0.1");
  }, SEEN_KEY);
}

test("after an upgrade, what's new opens once by itself", async ({ page }, info) => {
  await seedOlderVersionOnce(page);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const dialog = page.getByRole("dialog", { name: `Quoi de neuf dans Kibo ${APP_VERSION}` });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("listitem").first()).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Toutes les notes de version" })).toBeVisible();
  await shot(page, info, "137-quoi-de-neuf");
  await dialog.getByRole("button", { name: "Fermer" }).click();
  await expect(dialog).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), SEEN_KEY)).toBe(APP_VERSION);
  await page.reload();
  await expect(page.getByRole("tablist", { name: "Onglets" })).toBeVisible();
  await page.waitForTimeout(1_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("the help menu opens about, which copies the information and leads to the release notes", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("button", { name: /^Menu de / }).click();
  await page.getByRole("menuitem", { name: "Aide" }).click();
  await expect(page.getByRole("menuitem", { name: /^Raccourcis clavier/ })).toBeVisible();
  await page.getByRole("menuitem", { name: "À propos de Kibo" }).click();
  const about = page.getByRole("dialog", { name: "À propos de Kibo" });
  await expect(about.getByText(`Kibo ${APP_VERSION}`)).toBeVisible();
  await expect(about.getByText(/navigateur$/)).toBeVisible();
  await expect(about.getByText(/^Démon : PID \d+ · port \d+ · /)).toBeVisible();
  await about.getByRole("button", { name: "Copier les informations" }).click();
  await expect(about.getByRole("button", { name: "Copié" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied.split("\n")[0]).toBe(`Kibo ${APP_VERSION}`);
  await shot(page, info, "136-a-propos");
  await about.getByRole("button", { name: "Notes de version" }).click();
  await expect(page.getByRole("dialog", { name: `Quoi de neuf dans Kibo ${APP_VERSION}` })).toBeVisible();
});

test("the general settings show the application card, desktop only", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.goto("/#/settings/general");
  await expect(page.getByText("Application", { exact: true })).toBeVisible();
  await expect(page.getByText("Ce réglage vit dans l'application de bureau.")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Ouvrir Kibo à l'ouverture de session" })).toHaveCount(0);
  await shot(page, info, "76-general");
});
