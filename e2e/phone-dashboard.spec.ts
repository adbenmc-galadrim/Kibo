import { expect, test } from "@playwright/test";
import { noPageScroll, openTab, pairPhone } from "./phone-kit";

test("the phone Dashboard stacks the indicators and En ce moment without a wide page", async ({ page }) => {
  await pairPhone(page);
  await openTab(page, "Dashboard");
  const indicators = page.getByRole("region", { name: "Indicateurs du projet" });
  await expect(indicators).toContainText("Fonctionnalités");
  await expect(indicators).toContainText("Questions");
  await expect(page.getByRole("region", { name: "En ce moment" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Modifier le projet" })).toHaveCount(0);
  expect(await noPageScroll(page)).toBe(true);
});
