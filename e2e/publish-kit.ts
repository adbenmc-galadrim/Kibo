import { expect, type Locator, type Page } from "@playwright/test";
import { rpc } from "./agents-seed";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export async function publishDraft(page: Page, id: string, strategy: "update-all" | "new-version") {
  await expect(async () => {
    const preview = await rpc(page, { method: "previewPublish", id });
    expect(field(field(preview, "validation"), "ok")).toBe(true);
  }).toPass({ timeout: 120_000 });
  return rpc(page, { method: "publishComponent", id, strategy });
}

export async function addPendingComponent(page: Page, title: string, version: string): Promise<Locator> {
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: title, exact: true }).click();
  await page.getByRole("button", { name: "Ajouter à la page" }).click();
  const trust = page.getByRole("dialog", { name: `Autoriser « ${title} » ${version} ?` });
  await expect(trust).toBeVisible({ timeout: 60_000 });
  return trust;
}
