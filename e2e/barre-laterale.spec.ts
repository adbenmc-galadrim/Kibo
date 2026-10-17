import { expect, type Locator, type Page, test } from "@playwright/test";
import { screensDir } from "./pixel-screen";
import { openEmis, openEmisPage } from "./suivi-kit";

const SHOTS = screensDir("2026-10-17-r26-barre");

async function box(locator: Locator) {
  const found = await locator.boundingBox();
  if (found === null) throw new Error("the element has no box");
  return found;
}

function pageRow(page: Page, title: string) {
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  const row = sidebar.getByRole("button", { name: title, exact: true });
  const item = row.locator("xpath=ancestor::li[1]");
  return {
    sidebar,
    row,
    count: row.locator(".k-count"),
    action: item.getByRole("button", { name: `Actions de la page ${title}` }),
  };
}

const scheme = (): string => test.info().project.name.replace("suivi-", "");

test("the count of a sidebar page gives way to its ⋯ button on hover, focus and open menu", async ({
  page,
}) => {
  await openEmis(page);
  await openEmisPage(page, "Vue d'ensemble");
  const { sidebar, row, count, action } = pageRow(page, "Questions");
  const tickets = pageRow(page, "Tickets");
  await expect(count).toHaveText(/^\d+$/);
  await expect(count).toBeVisible();
  const rest = await box(row);

  await row.hover();
  await sidebar.screenshot({ path: `${SHOTS}/apres-survol-${scheme()}.png` });
  await expect(count).toBeHidden();
  await expect(action).toHaveCSS("opacity", "1");
  await expect(tickets.action).toHaveCSS("opacity", "0");
  await expect(tickets.count).toBeVisible();
  expect(await box(row)).toEqual(rest);

  await page.mouse.move(0, 0);
  await expect(count).toBeVisible();

  await action.focus();
  await expect(count).toBeHidden();
  await action.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(count).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await action.blur();
  await page.mouse.move(0, 0);
  await expect(count).toBeVisible();
  expect(await box(row)).toEqual(rest);
});
