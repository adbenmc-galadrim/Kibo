import { expect, test } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { clipboardText, kiboCli, type Silo } from "./planning-kit";
import { field, openSilo, openSiloPage } from "./suivi-kit";

let silo: Silo;

test.beforeEach(async ({ page }) => {
  silo = await openSilo(page);
});

test("la fiche SILO-45 s'ouvre par sa clé : puces, bandeau review et CI, chronologie et copie", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/#/p/${encodeURIComponent(silo.projectId)}/t/SILO-45`);
  const main = page.getByRole("main");
  await expect(main.getByText("F4", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("S42", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("changements demandés", { exact: true })).toHaveCount(1);
  await main.getByRole("button", { name: "Actions SILO-45" }).click();
  await page.getByRole("menuitem", { name: "Copier /full-delivery SILO-45" }).click();
  await expect(page.getByText(/^Copié/).first()).toBeVisible();
  expect(await clipboardText(page)).toBe("/full-delivery SILO-45");
  await main.getByRole("tab", { name: "Activité" }).click();
  await expect(main.getByText("Chronologie", { exact: true })).toBeVisible();
  await expect(main.getByText("PR #20 ouverte").first()).toBeVisible();
});

test("the Kanban « À reprendre » keeps SILO-45, its PR asks for changes", async ({ page }) => {
  await openSiloPage(page, "Kanban");
  await page.getByRole("button", { name: "À reprendre", exact: true }).click();
  const cards = page.getByRole("article");
  await expect(cards.filter({ hasText: "SILO-45" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "SILO-53" })).toHaveCount(0);
});

test("kibo tickets set branch= moves SILO-53 to En cours", async ({ page }, info) => {
  kiboCli(info, ["tickets", "set", "SILO-53", "branch=feat/silo-53"]);
  await page.goto(`/#/p/${encodeURIComponent(silo.projectId)}/t/SILO-53`);
  await expect(page.getByRole("main").getByText("En cours", { exact: true }).first()).toBeVisible();
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "keyLabel") === "SILO-53");
  expect(text(ticket, "statusId")).toBe("in_progress");
});
