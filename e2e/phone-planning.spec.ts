import { expect, test } from "@playwright/test";
import { macTitles, openTab, pairPhone } from "./phone-kit";

const TITLE = "Export comptable";

test("the phone Planning creates a feature that lands on the Mac and in À planifier", async ({ page }) => {
  await pairPhone(page);
  await openTab(page, "Planning");
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
  await page.getByRole("button", { name: "Fonctionnalité", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle fonctionnalité" });
  await dialog.getByRole("textbox", { name: "Nom" }).fill(TITLE);
  await dialog.getByRole("button", { name: "Créer la fonctionnalité" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("region", { name: "À planifier" }).getByRole("button", { name: TITLE, exact: true }),
  ).toBeVisible();
  await expect.poll(macTitles).toContain(TITLE);
});
