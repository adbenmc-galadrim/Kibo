import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 1100 } });

test("the first launch presents tracking, checks git, gh and GitHub, and says what gh missing costs", async ({
  page,
}, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading", { name: "Bienvenue dans Kibo" })).toBeVisible();
  await expect(
    main.getByText(/^Kibo suit tes projets : sprints, fonctionnalités, branches, PR et CI/),
  ).toBeVisible();

  const checks = main.getByRole("list").filter({ hasText: "GitHub CLI" });
  const row = (title: string) =>
    checks.getByRole("listitem").filter({ has: page.getByText(title, { exact: true }) });
  await expect(checks.getByRole("listitem")).toHaveCount(4);
  await expect(row("GitHub CLI")).toContainText(
    "gh introuvable · sans lui, ni PR, ni review, ni CI dans Kibo",
  );
  await expect(row("GitHub CLI")).not.toContainText("facultatif");
  await expect(row("Claude Code · pour l'agent de projet")).toContainText("claude détecté");
  await expect(
    row("Claude Code · pour l'agent de projet").getByRole("button", { name: "Réessayer" }),
  ).toHaveCount(0);
  await expect(row("Git")).toContainText("détecté");
  await expect(row("Compte GitHub")).toBeVisible();
  for (const gone of ["Démon local", "Capacité machine", "Isolation des composants"])
    await expect(main.getByText(gone)).toHaveCount(0);
  await expect(main.getByRole("button", { name: "Suivre le didacticiel (5 min)" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Créer mon premier projet" })).toBeVisible();
  await expect(main.getByRole("button", { name: "Importer un dossier existant" })).toBeVisible();
  await shot(page, info, "ecran-19");

  const env = await rpc(page, { method: "getEnvironment" });
  expect(env).toMatchObject({ gh: null });
  await shot(page, info, "ecran-78");
});
