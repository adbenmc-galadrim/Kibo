import { expect, test } from "@playwright/test";
import { macTicket, offlineBand, openTab, pairPhone, switchMacOff, switchMacOn } from "./phone-kit";

test("Mac off: the band gives the time, writes are refused, the Graphe stays, the band leaves on return", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const before = await macTicket("SILO-46");
  await pairPhone(page);
  await switchMacOff();
  try {
    await expect(offlineBand(page)).toBeVisible();
    await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();

    await openTab(page, "Kanban");
    await expect(offlineBand(page)).toBeVisible();
    await page.getByRole("button", { name: "Actions SILO-46" }).click();
    await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
    await page
      .getByRole("menu", { name: "Déplacer vers" })
      .getByRole("menuitem", { name: "Terminé" })
      .click();
    await expect(page.getByText("Mac éteint : modification refusée")).toBeVisible();
    await expect(page.getByText("Rien n'est mis en attente. Réessaie Mac allumé.")).toBeVisible();
    await openTab(page, "Graphe");
    await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();
  } finally {
    await switchMacOn();
  }
  await expect(offlineBand(page)).toBeHidden({ timeout: 30_000 });
  expect((await macTicket("SILO-46")).statusId).toBe(before.statusId);
});
