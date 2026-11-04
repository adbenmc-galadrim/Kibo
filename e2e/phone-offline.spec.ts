import { expect, test } from "@playwright/test";
import { macTicket, offlineBand, openTab, pairPhone, stallMac, switchMacOff, switchMacOn } from "./phone-kit";

test("Mac off: the band gives the time, writes are greyed, a card still opens, the Graphe stays, the band leaves on return", async ({
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
    await expect(page.getByRole("button", { name: "Nouveau ticket dans À faire" })).toBeDisabled();
    await page.getByRole("button", { name: "Actions SILO-46" }).click();
    await expect(page.getByRole("menuitem", { name: /^Supprimer…/ })).toBeDisabled();
    await expect(page.getByRole("menuitem", { name: "Ouvrir" })).toBeEnabled();
    await page.keyboard.press("Escape");
    const card = page.getByRole("article", { name: /^SILO-46 / });
    await card.getByRole("button", { name: "Démo · F4", exact: true }).click();
    await expect(page.getByRole("article", { name: "SILO-46" })).toBeVisible();
    await page.goBack();
    await openTab(page, "Graphe");
    await expect(page.getByRole("region", { name: "Fonctionnalités par sprint" })).toBeVisible();
  } finally {
    await switchMacOn();
  }
  await expect(offlineBand(page)).toBeHidden({ timeout: 30_000 });
  expect((await macTicket("SILO-46")).statusId).toBe(before.statusId);
});

test("a write in flight when the Mac goes off is refused with the toast, and nothing waits for its return", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const before = await macTicket("SILO-46");
  await pairPhone(page);
  await openTab(page, "Kanban");
  await page.getByRole("button", { name: "Actions SILO-46" }).click();
  await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
  await stallMac();
  try {
    await page
      .getByRole("menu", { name: "Déplacer vers" })
      .getByRole("menuitem", { name: "Terminé" })
      .click();
    await switchMacOff();
    await expect(page.getByText("Mac éteint : modification refusée")).toBeVisible();
    await expect(page.getByText("Rien n'est mis en attente. Réessaie Mac allumé.")).toBeVisible();
  } finally {
    await switchMacOn();
  }
  await expect(offlineBand(page)).toBeHidden({ timeout: 30_000 });
  expect((await macTicket("SILO-46")).statusId).toBe(before.statusId);
});
