import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { E2E_TOKEN } from "./token";

test.setTimeout(90_000);
test.use({ viewport: { width: 1440, height: 900 } });

const suffix = (info: TestInfo) => (info.project.name === "light" ? "l" : "d");

async function pair(page: Page) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  const res = await page.evaluate(async () => {
    const r = await fetch("/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        method: "setHost",
        patch: { hostSlots: 3, cpuThreshold: 100, ramThreshold: 100 },
      }),
    });
    return r.status;
  });
  expect(res).toBe(200);
}

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

test("profil, assignation, question, réponse : le ticket passe en review", async ({ page }, info) => {
  const s = suffix(info);
  const key = `AG${s.toUpperCase()}`;
  const profileName = `opus-dev-${s}`;
  await pair(page);

  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await page.getByLabel("Nom").fill(`Agents ${key}`);
  await page.getByLabel("Clé").fill(key);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom").fill("Kanban");
  await page.getByRole("radio", { name: "Vue", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à la page" }).click();
  await page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }).click();
  await page.getByLabel("Titre").fill("Récepteur de hooks");
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  const board = page.url();

  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau profil" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nom").fill(profileName);
  await sheet.getByText("Dossier isolé").click();
  await sheet.getByText("acceptEdits").click();
  await sheet.getByLabel("Runs en parallèle (profil)").fill("2");
  await sheet.getByRole("button", { name: "Sonnet", exact: true }).click();
  await sheet.getByRole("button", { name: "Haiku", exact: true }).click();
  await shot(page, info, "ecran-28");
  await sheet.getByRole("button", { name: "Créer le profil" }).click();
  await expect(page.getByRole("article", { name: profileName })).toBeVisible();

  await page.goto(board);
  const todo = page.getByRole("region", { name: "À faire" });
  await todo.getByRole("button", { name: "Récepteur de hooks" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Assigner à un agent" }).click();
  const assign = page.getByRole("dialog");
  await expect(assign.getByText(`Assigner ${key}-1 à un agent`)).toBeVisible();
  await assign.getByLabel("Profil").click();
  await page.getByRole("option", { name: new RegExp(`^${profileName} ·`) }).click();
  await assign.getByLabel("Brief (optionnel)").fill("Garder le port configurable.");
  await expect(assign.getByText(/démarre tout de suite|entrera en file/)).toBeVisible();
  await shot(page, info, "ecran-27");
  await assign.getByRole("button", { name: "Mettre en file" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  const answer = page.getByRole("button", { name: `Répondre à ${profileName}-1` });
  await expect(answer).toBeVisible({ timeout: 45_000 });
  await answer.click();
  await expect(
    page
      .getByRole("list", { name: `Journal de ${profileName}-1` })
      .getByText("Quel port pour le récepteur ?"),
  ).toBeVisible();
  await shot(page, info, "ecran-5");
  await page.getByLabel(`Réponse à ${profileName}-1`).fill("Port dynamique");
  await page.getByRole("button", { name: "Envoyer" }).click();

  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByText(`${key}-1`)).toBeVisible({ timeout: 45_000 });
  await expect(review.getByText(profileName)).toBeVisible();
});

test("files d'attente, agents et domaines s'affichent", async ({ page }, info) => {
  const s = suffix(info);
  await pair(page);
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page.getByRole("button", { name: "Files d'attente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Files d'attente" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Capacité de la machine" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "CPU" })).toBeVisible();
  await shot(page, info, "ecran-17");

  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Historique des runs" })).toBeVisible();
  await shot(page, info, "ecran-13");

  await page.getByRole("button", { name: "Paramètres" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Domaines & guidelines" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau domaine" }).click();
  await page.getByLabel("Nom du domaine").fill(`Core ${s}`);
  await page.getByRole("button", { name: "Créer" }).click();
  await page.getByRole("button", { name: `Core ${s}` }).click();
  await page.getByRole("button", { name: "Ajouter un fichier" }).click();
  await page.getByLabel("Chemin du fichier").fill("guidelines/core.md");
  await page.getByRole("button", { name: "Ajouter", exact: true }).click();
  const editor = page.getByLabel("Contenu de guidelines/core.md");
  await editor.fill("# Guidelines — domaine Core\n\n- Toute entité partagée a un schéma Zod.");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByRole("tab", { name: "Aperçu" }).click();
  await expect(page.getByRole("heading", { name: "Guidelines — domaine Core" })).toBeVisible();
  await shot(page, info, "ecran-14");
});
