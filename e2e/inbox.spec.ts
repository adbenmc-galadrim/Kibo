import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

test("un ticket sans projet, puis rattaché avec une nouvelle clé", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("main").getByRole("button", { name: "Ticket", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(dialog.getByRole("combobox", { name: "Projet" })).toHaveText("Boîte de réception");
  await expect(dialog.getByText("Clé INB-1")).toBeVisible();
  await dialog.getByLabel("Titre").fill("Appeler le comptable");
  await shot(page, info, "ecran-114");
  await dialog.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(dialog).toBeHidden();
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const inbox = page.getByRole("button", { name: /^Boîte de réception/ });
  await expect(sidebar.getByRole("listitem").filter({ has: inbox })).toContainText("1");
  await sidebar.locator(inbox).click();
  await expect(page).toHaveURL(/#\/inbox$/);
  const row = page.getByRole("row", { name: /INB-1/ });
  await expect(row).toBeVisible();
  await shot(page, info, "ecran-113");

  await row.getByRole("button", { name: /Appeler le comptable/ }).click();
  const sheet = page.getByRole("dialog", { name: "Appeler le comptable" }).filter({ hasText: "INB-1" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole("button", { name: /Assigner/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();

  await rpc(page, { method: "createProject", name: "Kibo INX", key: "INX", folder: null, color: "#F97316" });
  await row.getByRole("button", { name: "Rattacher…" }).click();
  const file = page.getByRole("dialog", { name: "Rattacher INB-1 à un projet" });
  await expect(file.getByText(/la prochaine est INX-1/)).toBeVisible();
  await shot(page, info, "ecran-115");
  await file.getByRole("button", { name: "Rattacher", exact: true }).click();
  await expect(file).toBeHidden();
  const filed = page.getByRole("dialog", { name: "Appeler le comptable" }).filter({ hasText: "INX-1" });
  await expect(filed).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(filed).toBeHidden();
  await expect(page.getByText("Rien en attente.")).toBeVisible();
  await shot(page, info, "ecran-113-vide");
});
