import { expect, type Page, test } from "@playwright/test";
import {
  boxOf,
  countPreviewCalls,
  createDialog,
  describeComponent,
  generateInBackground,
  openCreateDialog,
  pairOnComponents,
  pngFile,
  watchCspRefusals,
} from "./creations-helpers";
import { shot } from "./repo-project";

test.describe.configure({ mode: "serial" });

const BURNDOWN = "Burndown du sprint";
const COUNTER = "Compteur large";
const WORKER_URL = /\/workers\/draft-preview-worker-[A-Za-z0-9_-]+\.js$/;
const WORKER_CSP = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'";
const GENERATION = { timeout: 150_000 };
const PREVIEW = { timeout: 30_000 };

const previewFrame = (page: Page) => page.frameLocator(`iframe[title="Aperçu de ${BURNDOWN}"]`);

async function openCreation(page: Page, title: string) {
  await page.getByRole("button", { name: `Ouvrir ${title}` }).click();
  const dialog = createDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function closeInBackground(page: Page) {
  const dialog = createDialog(page);
  await dialog.getByRole("button", { name: "Continuer en arrière-plan" }).click();
  await expect(dialog).toBeHidden();
}

test("créer deux composants en arrière-plan, prévisualiser, réviser, publier", async ({ page }, info) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const refusals = watchCspRefusals(page);
  const previewCalls = countPreviewCalls(page);
  await pairOnComponents(page, info);

  const first = await openCreateDialog(page);
  await describeComponent(first, BURNDOWN, "Burndown du sprint : tickets restants par jour, avec le total.");
  await first.getByLabel("Ajouter des images").setInputFiles(pngFile("maquette.png"));
  await expect(first.getByRole("list", { name: "Images jointes" })).toContainText("maquette.png");
  await expect(first.getByRole("group", { name: "Formats" })).toBeVisible();
  await shot(page, info, "ecran-132");
  await generateInBackground(first);

  const second = await openCreateDialog(page);
  await describeComponent(second, COUNTER, "Compteur des tickets ouverts du sprint en cours.");
  await generateInBackground(second);

  const indicator = page.getByRole("button", { name: /^Créations ·/ });
  await indicator.hover();
  await shot(page, info, "ecran-131");
  await indicator.click();
  const active = page.getByRole("region", { name: /^En cours/ });
  await expect(active).toContainText(BURNDOWN);
  await expect(active).toContainText(COUNTER);

  const failed = await openCreation(page, COUNTER);
  await expect(failed.getByText(new RegExp(`${COUNTER} · la validation a trouvé \\d+ problème`))).toBeVisible(
    GENERATION,
  );
  await expect(failed.getByText("Échec", { exact: true })).toBeVisible();
  await closeInBackground(page);
  await expect(page.getByRole("region", { name: "En cours (2)" })).toBeVisible();
  await shot(page, info, "ecran-130");

  const review = await openCreation(page, BURNDOWN);
  const previewTab = review.getByRole("tab", { name: "Aperçu" });
  await expect(previewTab).toBeVisible(GENERATION);
  await expect(review.getByRole("tab", { name: "Diff" })).toHaveAttribute("aria-selected", "true");
  const spawned = page.waitForEvent("worker", PREVIEW);
  await previewTab.click();
  const worker = await spawned;
  expect(worker.url()).toMatch(WORKER_URL);
  const frame = previewFrame(page);
  await expect(frame.getByText("tickets restants", { exact: true })).toBeVisible(PREVIEW);
  await expect(frame.getByText(/^\d+$/)).toBeVisible();
  await expect(review.getByText("Aperçu indisponible.")).toHaveCount(0);

  const formats = review.getByRole("radiogroup", { name: "Format de l'aperçu" });
  await formats.getByRole("radio", { name: "Large" }).click();
  await expect(frame.getByText("tickets restants", { exact: true })).toBeVisible(PREVIEW);
  await shot(page, info, "ecran-133");
  const callsBefore = previewCalls();
  expect(callsBefore).toBeGreaterThan(0);
  await formats.getByRole("radio", { name: "Demi-page" }).click();
  const iframe = review.locator(`iframe[title="Aperçu de ${BURNDOWN}"]`);
  await expect(async () => expect((await boxOf(iframe)).width).toBe(1196)).toPass(PREVIEW);
  await expect(frame.getByText("tickets restants", { exact: true })).toBeVisible(PREVIEW);
  expect(previewCalls()).toBe(callsBefore);
  await expect(review.getByText("Aperçu indisponible.")).toHaveCount(0);

  const workerScript = await page.request.get(worker.url());
  expect(workerScript.ok()).toBe(true);
  expect(workerScript.headers()["content-security-policy"]).toBe(WORKER_CSP);
  const documentCsp = (await page.request.get("/")).headers()["content-security-policy"] ?? "";
  expect(documentCsp).not.toBe("");
  expect(documentCsp).not.toContain("wasm-unsafe-eval");

  await review.getByRole("button", { name: "Demander une modification" }).click();
  await review.getByLabel("Ce qu'il faut changer").fill("Mets le total en gros");
  await review.getByLabel("Ajouter des images").setInputFiles(pngFile("retour.png"));
  await expect(review.getByRole("list", { name: "Images jointes" })).toContainText("retour.png");
  await shot(page, info, "ecran-134");
  await review.getByRole("button", { name: "Envoyer à l'agent" }).click();
  await expect(review.getByText("Révision 1 sur 10")).toBeVisible(PREVIEW);

  await expect(review.getByRole("tab", { name: "Diff" })).toHaveAttribute(
    "aria-selected",
    "true",
    GENERATION,
  );
  await review.getByRole("tab", { name: "Aperçu" }).click();
  await expect(frame.getByText(/\(révisé\)/)).toBeVisible(PREVIEW);
  await expect(review.getByText("Aperçu indisponible.")).toHaveCount(0);

  await review.getByRole("button", { name: "J'ai relu, continuer" }).click();
  const trust = page.getByRole("dialog", { name: `Autoriser « ${BURNDOWN} » 0.1.0 ?` });
  await trust.getByRole("button", { name: "Autoriser", exact: true }).click();
  await expect(trust).toBeHidden(PREVIEW);
  await expect(review).toBeHidden();
  const finished = page.getByRole("region", { name: /^Terminées/ });
  await expect(finished.getByRole("row", { name: new RegExp(BURNDOWN) })).toContainText("Publié");
  await expect(page.getByRole("region", { name: /^En cours/ })).not.toContainText(BURNDOWN);
  expect(refusals).toEqual([]);
});

test("la fenêtre reste bornée à 700 px de haut", async ({ page }, info) => {
  await page.setViewportSize({ width: 1440, height: 700 });
  await pairOnComponents(page, info);
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
