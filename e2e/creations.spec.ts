import { test } from "@playwright/test";
import { boxOf, describeComponent, expect, openCreateDialog, pairOnDashboard } from "./creations-helpers";
import { shot } from "./repo-project";

const PREVIEW = { timeout: 60_000 };

test("la fenêtre reste bornée à 700 px de haut", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await pairOnDashboard(page, info);
  const dialog = await openCreateDialog(page);
  await describeComponent(dialog, "Météo", "Météo du jour pour l'équipe, avec la température.");
  const scrolls = await dialog.evaluate((el) => el.scrollHeight > el.clientHeight);
  expect(scrolls).toBe(true);
  await dialog.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
  const heading = dialog.getByRole("heading", { name: "Créer un composant" });
  await expect(async () => {
    const box = await boxOf(dialog);
    expect(box.height).toBeLessThanOrEqual(668);
    expect(box.y).toBeGreaterThanOrEqual(16);
    const top = (await boxOf(heading)).y;
    expect(top).toBeGreaterThanOrEqual(box.y);
    expect(top).toBeLessThan(box.y + 80);
  }).toPass(PREVIEW);
  await expect(dialog.getByRole("button", { name: "Générer avec un agent" })).toBeInViewport();
  await shot(page, info, "ecran-135");
});
