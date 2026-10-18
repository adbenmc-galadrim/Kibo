import { expect, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { clipboardText } from "./planning-kit";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 1000 } });

const QUESTION = "Connexion par e-mail seulement, ou aussi par un compte Google ?";
const STEPS = [
  "Lire la Vue d'ensemble",
  "Créer une fonctionnalité",
  "Voir une étape passer en review",
  "Répondre à une question",
  "Copier /full-delivery",
];

const panel = (page: Page) => page.getByRole("complementary", { name: "Didacticiel" });
const dot = (page: Page, title: string, state: "fait" | "en cours") =>
  panel(page).getByRole("listitem", { name: `${title} · ${state}` });
const sidebar = (page: Page) => page.locator('[data-sidebar="sidebar"]');
const demoEntry = (page: Page) => sidebar(page).getByRole("button", { name: /^Démo Kibo/ });
const main = (page: Page) => page.getByRole("main");

async function goToStep(page: Page) {
  const go = panel(page).getByRole("button", { name: "Aller à la page" });
  if (await go.isVisible()) await go.click();
}

async function openHelpTutorial(page: Page) {
  await page.getByRole("button", { name: /^Menu de / }).click();
  await page.getByRole("menuitem", { name: "Aide" }).click();
  await page.getByRole("menuitem", { name: "Didacticiel" }).click();
  return page.getByRole("dialog", { name: "Faire le tour de Kibo ?" });
}

async function startTour(page: Page, info: Parameters<typeof shot>[1]) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("main").getByRole("button", { name: "Suivre le didacticiel (5 min)" }).click();
  const offer = page.getByRole("dialog", { name: "Faire le tour de Kibo ?" });
  await expect(offer.getByRole("listitem")).toHaveText(STEPS);
  await expect(offer.getByText(/Aucun agent n'est lancé/)).toBeVisible();
  await shot(page, info, "proposition");
  await offer.getByRole("button", { name: "Commencer" }).click();
  await expect(offer).toBeHidden();
  await expect(demoEntry(page)).toBeVisible();
  for (const title of ["Vue d'ensemble", "Planning", "Kanban", "Graphe", "Questions"])
    await expect(sidebar(page).getByRole("button", { name: title, exact: true })).toBeVisible();
}

async function readOverview(page: Page) {
  await expect(dot(page, STEPS[0] ?? "", "en cours")).toBeVisible();
  await goToStep(page);
  await expect(main(page).getByText("Panier et commande").first()).toBeVisible();
  await panel(page).getByRole("button", { name: "C'est lu" }).click();
  await expect(dot(page, STEPS[0] ?? "", "fait")).toBeVisible();
}

async function createFeature(page: Page) {
  await goToStep(page);
  await main(page).getByRole("button", { name: "Fonctionnalité", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle fonctionnalité" });
  await dialog.getByLabel("Nom").fill("Livraison à domicile");
  await dialog.getByRole("button", { name: "Créer la fonctionnalité" }).click();
  await expect(dialog).toBeHidden();
  await expect(dot(page, STEPS[1] ?? "", "fait")).toBeVisible();
}

async function simulateReview(page: Page) {
  await goToStep(page);
  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByText("Paiement en ligne")).toHaveCount(0);
  await panel(page).getByRole("button", { name: "Simuler la PR" }).click();
  await expect(review.getByText("Paiement en ligne")).toBeVisible();
  await expect(dot(page, STEPS[2] ?? "", "fait")).toBeVisible();
}

async function answerQuestion(page: Page) {
  await goToStep(page);
  const question = main(page).getByRole("article", { name: QUESTION, exact: true });
  await expect(question.getByText("bloquante", { exact: true })).toBeVisible();
  const field = question.getByRole("textbox", { name: /réponse…$/ });
  await field.fill("Par e-mail seulement");
  await field.press("Enter");
  await expect(page.getByText(/^F3 débloquée/).first()).toBeVisible();
  await expect(dot(page, STEPS[3] ?? "", "fait")).toBeVisible();
}

async function copyCommand(page: Page) {
  await panel(page).getByRole("button", { name: "Copier /full-delivery DEMO-5" }).click();
  expect(await clipboardText(page)).toBe("/full-delivery DEMO-5");
  await expect(panel(page).getByText("Bravo, tu as fait le tour de Kibo")).toBeVisible();
}

test("the tutorial walks the five tracking steps on daemon events, without any agent", async ({
  page,
  context,
}, info) => {
  test.setTimeout(120_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await startTour(page, info);
  await shot(page, info, "panneau-etape-1");
  await readOverview(page);

  await panel(page).getByRole("button", { name: "Mettre en pause" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.reload();
  const resume = await openHelpTutorial(page);
  await resume.getByRole("button", { name: "Reprendre" }).click();
  await expect(dot(page, STEPS[1] ?? "", "en cours")).toBeVisible();

  await createFeature(page);
  await simulateReview(page);
  await answerQuestion(page);
  await copyCommand(page);
  await shot(page, info, "fin");

  await panel(page).getByRole("button", { name: "Fermer" }).click();
  await expect(panel(page)).toHaveCount(0);
  await page.reload();
  await expect(demoEntry(page)).toBeVisible();
  await expect(panel(page)).toHaveCount(0);

  const again = await openHelpTutorial(page);
  await again.getByRole("button", { name: "Recommencer" }).click();
  await expect(dot(page, STEPS[0] ?? "", "en cours")).toBeVisible();
  await expect(dot(page, STEPS[2] ?? "", "fait")).toBeVisible();
  await expect(dot(page, STEPS[3] ?? "", "fait")).toBeVisible();
  await panel(page).getByRole("button", { name: "Passer cette étape" }).click();
  await expect(dot(page, STEPS[0] ?? "", "fait")).toBeVisible();
  for (const step of ["feature", "copy"] as const) await rpc(page, { method: "skipTutorialStep", step });
  await expect(panel(page).getByText("Bravo, tu as fait le tour de Kibo")).toBeVisible();

  await panel(page).getByRole("button", { name: "Supprimer le projet de démo" }).click();
  const remove = page.getByRole("dialog", { name: "Supprimer le projet de démonstration ?" });
  await shot(page, info, "suppression");
  await remove.getByRole("button", { name: "Supprimer la démo" }).click();
  await expect(demoEntry(page)).toHaveCount(0);
  await expect(panel(page)).toHaveCount(0);
});
