import { expect, type Locator, type Page, test } from "@playwright/test";
import { screensDir } from "./pixel-screen";
import { openSilo, openSiloPage } from "./suivi-kit";

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
  await openSilo(page);
  await openSiloPage(page, "Vue d'ensemble");
  const { sidebar, row, count, action } = pageRow(page, "Questions");
  const planning = pageRow(page, "Planning");
  await expect(count).toHaveText(/^\d+$/);
  await expect(count).toBeVisible();
  const rest = await box(row);

  await row.hover();
  await sidebar.screenshot({ path: `${SHOTS}/apres-survol-${scheme()}.png` });
  await expect(count).toBeHidden();
  await expect(action).toHaveCSS("opacity", "1");
  await expect(planning.action).toHaveCSS("opacity", "0");
  await expect(planning.count).toBeVisible();
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

test("under 48rem every ⋯ stays shown and the counts of editable rows stay hidden", async ({ page }) => {
  await openSilo(page);
  await page.setViewportSize({ width: 700, height: 900 });
  await openSiloPage(page, "Vue d'ensemble");
  await page.getByRole("button", { name: "Afficher ou masquer la barre latérale" }).first().click();
  const questions = pageRow(page, "Questions");
  const planning = pageRow(page, "Planning");
  await expect(questions.row).toBeVisible();
  await page.mouse.move(0, 0);
  for (const line of [questions, planning]) {
    await expect(line.action).toHaveCSS("opacity", "1");
    await expect(line.count).toBeHidden();
  }
  await questions.sidebar.screenshot({ path: `${SHOTS}/apres-etroit-${scheme()}.png` });
});
