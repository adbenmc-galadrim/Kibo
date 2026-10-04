import { expect, type Page, test } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 1000 } });

const panel = (page: Page) => page.getByRole("complementary", { name: "Didacticiel" });
const dot = (page: Page, title: string, state: "fait" | "en cours") =>
  panel(page).getByRole("listitem", { name: `${title} · ${state}` });
const sidebar = (page: Page) => page.locator('[data-sidebar="sidebar"]');
const demoEntry = (page: Page) => sidebar(page).getByRole("button", { name: /^Démo Kibo/ });

async function goToStep(page: Page) {
  await panel(page).getByRole("button", { name: "Aller à la page" }).click();
}

async function openHelpTutorial(page: Page) {
  await page.getByRole("button", { name: /^Menu de / }).click();
  await page.getByRole("menuitem", { name: "Aide" }).click();
  await page.getByRole("menuitem", { name: "Didacticiel" }).click();
  return page.getByRole("dialog", { name: "Faire le tour de Kibo ?" });
}

async function demoRuns(page: Page) {
  const agents = await rpc(page, { method: "getAgents" });
  return list(agents, "runs").filter((r) => text(r, "profileId") === "demo");
}

test("the tutorial walks the six steps in the demo project, then deletes it in one click", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("main").getByRole("button", { name: "Suivre le didacticiel (10 min)" }).click();
  const offer = page.getByRole("dialog", { name: "Faire le tour de Kibo ?" });
  await expect(offer.getByRole("listitem")).toHaveCount(6);
  await shot(page, info, "proposition");
  await offer.getByRole("button", { name: "Commencer" }).click();
  await expect(offer).toBeHidden();
  await expect(demoEntry(page)).toBeVisible();
  await expect(demoEntry(page)).toContainText("Démo");
  await expect(dot(page, "Créer un ticket et le déplacer", "en cours")).toBeVisible();
  await shot(page, info, "panneau-etape-1");

  await goToStep(page);
  await page.getByRole("button", { name: "Ticket", exact: true }).click();
  const create = page.getByRole("dialog");
  await create.getByLabel("Titre", { exact: true }).fill("Mon premier ticket");
  await create.getByLabel("Statut").click();
  await page.getByRole("option", { name: "En cours" }).click();
  await create.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(create).toBeHidden();
  await expect(dot(page, "Créer un ticket et le déplacer", "fait")).toBeVisible();

  await page
    .getByRole("region", { name: "En cours" })
    .getByRole("button", { name: "Mon premier ticket" })
    .click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("button", { name: "Ajouter une dépendance" }).click();
  await sheet.getByRole("textbox", { name: "Ticket" }).fill("Monorepo");
  await sheet.getByRole("option", { name: /Monorepo/ }).click();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(dot(page, "Lier deux tickets", "en cours")).toBeVisible();
  await goToStep(page);
  await expect(page.getByRole("region", { name: "Graphe des dépendances" })).toBeVisible();
  await expect(dot(page, "Lier deux tickets", "fait")).toBeVisible();

  await goToStep(page);
  await page.getByRole("button", { name: /^Bienvenue dans la démo/ }).click();
  await page.getByRole("article").getByRole("button", { name: "Modifier" }).click();
  const editor = page.getByRole("textbox", { name: "Contenu de la note" });
  await editor.click();
  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.type("\n\nun mot");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page.keyboard.press("Shift+ArrowLeft");
  await page
    .getByRole("toolbar", { name: "Mise en forme", exact: true })
    .getByRole("button", { name: "Gras" })
    .click();
  await expect(page.getByText("Enregistré • local")).toBeVisible({ timeout: 5_000 });
  await expect(dot(page, "Écrire une note", "fait")).toBeVisible();

  await goToStep(page);
  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: "Redimensionner Notes (droite)" }).focus();
  await page.keyboard.press("Shift+ArrowDown");
  await expect(page.getByRole("toolbar", { name: "Disposition" })).toContainText("1 changement");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dot(page, "Réorganiser le tableau de bord", "fait")).toBeVisible();

  await goToStep(page);
  await page
    .getByRole("region", { name: "À faire" })
    .getByRole("button", { name: "Coque et sidecar" })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Assigner à un agent" }).click();
  const assign = page.getByRole("dialog");
  await expect(assign.getByLabel("Profil")).toHaveText("Agent de démonstration · aucun token consommé");
  await shot(page, info, "assigner-demo");
  await assign.getByRole("button", { name: "Mettre en file" }).click();
  await expect(assign).toBeHidden();
  await page.getByRole("button", { name: /^Répondre à / }).click({ timeout: 30_000 });
  await page.getByLabel(/^Réponse à /).fill("Non");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(dot(page, "Confier un ticket à un agent", "fait")).toBeVisible({ timeout: 45_000 });
  const runs = await demoRuns(page);
  expect(runs.length).toBe(1);
  expect(runs[0]).toMatchObject({ state: "done", tokens: 0, costUsd: 0 });

  await goToStep(page);
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("button", { name: /Créer un composant/ }).click();
  const describe = page.getByRole("dialog", { name: "Créer un composant" });
  await expect(describe.getByText("Agent de démonstration · aucun token consommé")).toBeVisible();
  await shot(page, info, "decrire-demo");
  await describe
    .getByLabel("Ce que doit faire le composant")
    .fill("Avancement du sprint : tickets terminés par jour.");
  await describe.getByLabel("Gabarit").click();
  await page.getByRole("option", { name: "Graphique" }).click();
  await describe.getByRole("button", { name: "Générer avec un agent" }).click();
  await expect(describe.getByRole("list", { name: "Relire le diff" })).toBeVisible({ timeout: 120_000 });
  await describe.getByRole("button", { name: "J'ai relu, continuer" }).click();
  const trust = page.getByRole("dialog", { name: /^Autoriser « / });
  await trust.getByRole("button", { name: "Autoriser et ajouter" }).click();
  await expect(trust).toBeHidden({ timeout: 60_000 });
  await expect(panel(page).getByText("Bravo, tu as fait le tour de Kibo")).toBeVisible({ timeout: 30_000 });
  await shot(page, info, "fin");

  await panel(page).getByRole("button", { name: "Supprimer le projet de démo" }).click();
  const remove = page.getByRole("dialog", { name: "Supprimer le projet de démonstration ?" });
  await shot(page, info, "suppression");
  await remove.getByRole("button", { name: "Supprimer la démo" }).click();
  await expect(demoEntry(page)).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);

  const again = await openHelpTutorial(page);
  await again.getByRole("button", { name: "Recommencer" }).click();
  await expect(demoEntry(page)).toBeVisible();
  await expect(dot(page, "Créer un ticket et le déplacer", "en cours")).toBeVisible();
  await panel(page).getByRole("button", { name: "Mettre en pause" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.reload();
  const resume = await openHelpTutorial(page);
  await resume.getByRole("button", { name: "Reprendre" }).click();
  await expect(dot(page, "Créer un ticket et le déplacer", "en cours")).toBeVisible();

  await page.goto("/#/agents");
  const demoCard = page.getByRole("article", { name: "Agent de démonstration" });
  await expect(demoCard.getByText("aucun token consommé")).toBeVisible();
  await shot(page, info, "agents-demo");
});
