import { expect, test } from "@playwright/test";
import { macRpc, macTicket, noPageScroll, openTab, pairPhone } from "./phone-kit";

test("the phone Kanban filters its cards and moves SILO-45 through the card menu, on the Mac", async ({
  page,
}) => {
  const before = await macTicket("SILO-45");
  await pairPhone(page);
  await openTab(page, "Kanban");
  const filters = page.getByRole("group", { name: "Tickets affichés" });
  const startable = filters.getByRole("button", { name: /^Démarrable/ });
  const count = Number((await startable.innerText()).replace(/\D/g, ""));
  await startable.click();
  await expect(startable).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main").getByRole("article")).toHaveCount(count);
  await filters.getByRole("button", { name: /^Tous/ }).click();
  expect(await noPageScroll(page)).toBe(true);

  await page.getByRole("button", { name: "Actions SILO-45" }).click();
  await page.getByRole("menuitem", { name: "Déplacer vers" }).click();
  await page.getByRole("menu", { name: "Déplacer vers" }).getByRole("menuitem", { name: "À faire" }).click();
  await expect(
    page.getByRole("region", { name: "À faire" }).getByRole("article", { name: /^SILO-45 / }),
  ).toBeVisible();
  await expect.poll(async () => (await macTicket("SILO-45")).statusId).toBe("todo");

  await macRpc({
    method: "command",
    projectId: before.projectId,
    command: { method: "setStatus", ticketId: before.id, statusId: before.statusId },
  });
});
