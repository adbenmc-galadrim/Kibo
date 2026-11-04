import { expect, test } from "@playwright/test";
import { noPageScroll, pairPhone } from "./phone-kit";

test("the phone Graphe shows sprint columns, switches to PRs, folds every frame and opens a ticket", async ({
  page,
}) => {
  await pairPhone(page);
  const columns = page.getByRole("region", { name: "Fonctionnalités par sprint" }).getByRole("group");
  await expect(columns.and(page.getByRole("group", { name: "S42 Saisie hors ligne" }))).toBeVisible();
  expect(await columns.count()).toBeGreaterThanOrEqual(4);
  expect(await noPageScroll(page)).toBe(true);

  await page.getByText("PRs", { exact: true }).click();
  await expect(page.getByRole("radio", { name: "PRs" })).toBeChecked();
  const prs = page.getByRole("region", { name: "PR ouvertes" });
  await expect(prs.getByRole("button", { name: "PR #20 · Conflits de saisie · SILO-45" })).toBeVisible();

  await page.getByText("Fonctionnalités", { exact: true }).click();
  await page.getByRole("button", { name: "Tout voir" }).click();
  const unfold = page.getByRole("button", { name: "Déplier tout" });
  await expect(unfold).toHaveAttribute("aria-pressed", "true");
  const f4 = page.getByRole("article", { name: "F4 Saisir un constat hors ligne" });
  await expect(f4.getByRole("listitem")).toHaveCount(0);
  await unfold.click();
  await expect(page.getByRole("button", { name: "Tout voir" })).toBeVisible();

  await f4.getByRole("button", { name: /^Conflits de saisie/ }).click();
  await expect(page.getByRole("banner").first()).toContainText("Fiche du ticket");
  await expect(page.getByRole("article", { name: "SILO-45" })).toBeVisible();
});
