import { expect as baseExpect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { E2E_TOKEN } from "./token";

export const expect = baseExpect.configure({ timeout: 60_000 });

const ONE_PIXEL_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const CSP_REFUSAL = /Refused to|Content Security Policy/;

export const pngFile = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.from(ONE_PIXEL_PNG, "base64"),
});

export async function pairOnComponents(page: Page, info: TestInfo) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);
  await page.goto("/#/components");
  await expect(page.getByRole("heading", { name: "Composants", level: 1 })).toBeVisible();
}

export const createDialog = (page: Page): Locator => page.getByRole("dialog", { name: "Créer un composant" });

export async function openCreateDialog(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: "Créer un composant", exact: true }).click();
  const dialog = createDialog(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

export async function describeComponent(dialog: Locator, title: string, description: string) {
  await dialog.getByLabel("Ce que doit faire le composant").fill(description);
  await dialog.getByLabel("Titre", { exact: true }).fill(title);
}

export async function generateInBackground(dialog: Locator) {
  await dialog.getByRole("button", { name: "Générer avec un agent" }).click();
  await dialog.getByRole("button", { name: "Continuer en arrière-plan" }).click();
  await expect(dialog).toBeHidden();
}

export function watchCspRefusals(page: Page): string[] {
  const refusals: string[] = [];
  page.on("console", (message) => {
    if (CSP_REFUSAL.test(message.text())) refusals.push(message.text());
  });
  page.on("pageerror", (error) => {
    if (CSP_REFUSAL.test(error.message)) refusals.push(error.message);
  });
  return refusals;
}

export function countPreviewCalls(page: Page): () => number {
  let calls = 0;
  page.on("request", (request) => {
    if (!request.url().endsWith("/api/rpc")) return;
    if (request.postData()?.includes('"previewComponentDraft"')) calls++;
  });
  return () => calls;
}

export async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box;
}
