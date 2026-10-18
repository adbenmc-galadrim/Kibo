import { expect, test } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { clipboardText, type Emis, kiboCli } from "./planning-kit";
import { field, openEmis, openEmisPage } from "./suivi-kit";

let emis: Emis;

test.beforeEach(async ({ page }) => {
  emis = await openEmis(page);
});

test("la fiche EMIS-45 s'ouvre par sa clé : puces, bandeau review et CI, chronologie et copie", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/#/p/${encodeURIComponent(emis.projectId)}/t/EMIS-45`);
  const main = page.getByRole("main");
  await expect(main.getByText("F4", { exact: true }).first()).toBeVisible();
  await expect(main.getByText("S42", { exact: true }).first()).toBeVisible();
  const banner = main.getByRole("status").filter({ hasText: "changements demandés" });
  await expect(banner).toContainText("PR #20 · changements demandés · CI cassée");
  await main.getByRole("button", { name: "Copier /full-delivery EMIS-45" }).click();
  await expect(page.getByText(/^Copié/).first()).toBeVisible();
  expect(await clipboardText(page)).toBe("/full-delivery EMIS-45");
  await main.getByRole("tab", { name: "Activité" }).click();
  await expect(main.getByText("Chronologie", { exact: true })).toBeVisible();
  await expect(main.getByText("PR #20 ouverte").first()).toBeVisible();
});

test("the Kanban « À reprendre » keeps EMIS-45, its PR asks for changes", async ({ page }) => {
  await openEmisPage(page, "Kanban");
  await page.getByRole("button", { name: "À reprendre", exact: true }).click();
  const cards = page.getByRole("article");
  await expect(cards.filter({ hasText: "EMIS-45" })).toHaveCount(1);
  await expect(cards.filter({ hasText: "EMIS-53" })).toHaveCount(0);
});

test("kibo tickets set branch= moves EMIS-53 to En cours", async ({ page }, info) => {
  kiboCli(info, ["tickets", "set", "EMIS-53", "branch=feat/emis-53"]);
  await page.goto(`/#/p/${encodeURIComponent(emis.projectId)}/t/EMIS-53`);
  await expect(page.getByRole("main").getByText("En cours", { exact: true }).first()).toBeVisible();
  const snapshot = await rpc(page, { method: "getProject", projectId: emis.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "keyLabel") === "EMIS-53");
  expect(text(ticket, "statusId")).toBe("in_progress");
});
