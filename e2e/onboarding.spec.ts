import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 1100 } });

test("screen 19 lists the checks and offers the tutorial; screen 78 reports gh missing", async ({
  page,
}, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Bienvenue dans Kibo" })).toBeVisible();

  const row = (title: string) => main.getByRole("listitem").filter({ hasText: title });
  await expect(row("GitHub CLI")).toContainText("gh introuvable · facultatif");
  await expect(row("Claude Code")).toContainText("claude détecté");
  await expect(row("Claude Code").getByRole("button", { name: "Réessayer" })).toHaveCount(0);
  await expect(row("Git").first()).toContainText("détecté");
  await expect(main.getByRole("button", { name: "Réessayer" })).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Suivre le didacticiel (10 min)" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Créer mon premier projet" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Importer un dossier existant" })).toBeVisible();
  await shot(page, info, "ecran-19");

  const env = await rpc(page, { method: "getEnvironment" });
  expect(env).toMatchObject({ gh: null });
  await shot(page, info, "ecran-78");
});
