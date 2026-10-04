import { expect, type Page, test } from "@playwright/test";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

const APPLE_AHEAD = 148.5 / 277;

const fixRandom = (page: Page, value: number | null) =>
  page.evaluate((v) => {
    const saved = Reflect.get(window, "__random") ?? Math.random;
    Reflect.set(window, "__random", saved);
    Math.random = v === null ? saved : () => v;
  }, value);

test("le Serpent : plein écran sans remontage, partie, meilleur score gardé", async ({ page }, info) => {
  await pairAndCreateProject(page, info, projectKey("SNK", info));
  await createPage(page, "Jeux", "Tableau de bord");
  await addComponent(page, "Serpent");
  const board = page.getByRole("img", { name: /Plateau du serpent/ });
  const status = page.getByRole("status").filter({ hasText: "Meilleur" });
  await expect(board).toBeVisible();
  await expect(status).toHaveText("Score 0 · Meilleur 0 · Appuie sur Espace pour jouer · F : plein écran");
  await shot(page, info, "serpent-widget");

  const id = await board.getAttribute("data-game-id");
  await page.getByRole("button", { name: "Plein écran" }).click();
  const dialog = page.getByRole("dialog", { name: "Serpent" });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box?.width).toBeGreaterThan(1400);
  expect(box?.height).toBeGreaterThan(860);
  await expect(board).toHaveAttribute("data-game-id", id ?? "");
  await expect(page.getByRole("button", { name: "Quitter le plein écran (Échap)" })).toBeFocused();
  await shot(page, info, "serpent-plein-ecran");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(board).toHaveAttribute("data-game-id", id ?? "");

  await board.click();
  await page.keyboard.press("Space");
  await expect(status).toHaveText("Score 0 · Meilleur 0");
  await page.keyboard.press("ArrowUp");
  await expect(status).toHaveText("Score 0 · Meilleur 0 · Perdu, Espace pour rejouer");

  await fixRandom(page, APPLE_AHEAD);
  await page.keyboard.press("Space");
  await expect(status).toContainText("Score 1 · Meilleur 1");
  await fixRandom(page, null);
  await expect(status).toHaveText("Score 1 · Meilleur 1 · Perdu, Espace pour rejouer");
  await shot(page, info, "serpent-perdu");

  await page.reload();
  await expect(status).toHaveText("Score 0 · Meilleur 1 · Appuie sur Espace pour jouer · F : plein écran");
});
