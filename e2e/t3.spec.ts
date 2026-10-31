import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { fakeGhDir } from "./git-repo";
import { siloPageUrl } from "./pixel-silo";

const CARD_TITLE = "Démo · F4";
const TITLE = "Démo client";
const KEY = "SILO-46";
const COPY_ENTRY = /full-delivery/;
const MAX_CARD_TABS = 6;

const fakeDir = (info: TestInfo): string => {
  const { baseURL } = info.project.use;
  if (baseURL === undefined) throw new Error("the t3 project has no baseURL");
  return fakeGhDir(new URL(baseURL).port);
};

const openKanban = async (page: Page) => {
  await pairBrowser(page);
  await page.goto(await siloPageUrl(page, "Kanban"));
  return page.getByRole("article", { name: new RegExp(`^${KEY} `) });
};

const launchableCard = (page: Page) =>
  page
    .getByRole("article")
    .filter({ has: page.getByRole("button", { name: "Lancer dans T3" }) })
    .first();

const loggedStarts = (dir: string): string[][] => {
  const log = join(dir, "t3-log.jsonl");
  if (!existsSync(log)) return [];
  return readFileSync(log, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .map((line): string[] => JSON.parse(line))
    .filter((argv) => argv[0] === "thread" && argv[1] === "start");
};

test.describe.configure({ mode: "serial" });

test("launching SILO-46 from the Kanban creates the thread and shows the badge", async ({ page }, info) => {
  const card = await openKanban(page);
  const before = loggedStarts(fakeDir(info)).length;
  await card.hover();
  await card.getByRole("button", { name: "Lancer dans T3" }).click();
  const dialog = page.getByRole("dialog", { name: `Lancer ${KEY} dans T3` });
  await dialog.getByRole("button", { name: "Lancer", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(card.getByText(/^T3 · en cours depuis/)).toBeVisible();
  await expect(card.getByRole("button", { name: "Lancer dans T3" })).toHaveCount(0);
  const starts = loggedStarts(fakeDir(info));
  expect(starts).toHaveLength(before + 1);
  const argv = starts.at(-1) ?? [];
  expect(argv.slice(0, 2)).toEqual(["thread", "start"]);
  expect(argv[3]).toBe(`/full-delivery ${KEY}`);
  expect(argv.slice(4)).toEqual(["--title", `${KEY} · ${TITLE}`, "--json"]);
  await card.getByRole("button", { name: CARD_TITLE }).click();
  const sheet = page.getByRole("dialog", { name: CARD_TITLE });
  await expect(sheet.getByText(/^T3 · en cours depuis/)).toBeVisible();
});

test("the launch button is reached with the keyboard from the card", async ({ page }) => {
  await pairBrowser(page);
  await page.goto(await siloPageUrl(page, "Kanban"));
  await page.getByRole("button", { name: "Démarrable" }).click();
  const card = launchableCard(page);
  await card.waitFor();
  const launch = card.getByRole("button", { name: "Lancer dans T3" });
  await card.focus();
  for (let tab = 0; tab < MAX_CARD_TABS; tab += 1) {
    await page.keyboard.press("Tab");
    if (await launch.evaluate((button) => button === document.activeElement)) break;
  }
  await expect(launch).toBeFocused();
  await expect(launch).toBeVisible();
  const box = await launch.boundingBox();
  expect(box?.height).toBeGreaterThan(20);
});

test("with the server down the button is disabled and the command can still be copied", async ({
  page,
}, info) => {
  const statePath = join(fakeDir(info), "t3-state.json");
  const original = readFileSync(statePath, "utf8");
  writeFileSync(statePath, JSON.stringify({ ...JSON.parse(original), mode: "server-down" }));
  try {
    await pairBrowser(page);
    await page.goto(await siloPageUrl(page, "Kanban"));
    await page.getByRole("button", { name: "Démarrable" }).click();
    const card = launchableCard(page);
    await card.hover();
    await expect(card.getByRole("button", { name: "Lancer dans T3" })).toBeDisabled();
    await card.locator("button", { hasNotText: "Lancer" }).last().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("button", { name: "Lancer dans T3" })).toBeDisabled();
    await sheet.getByRole("button", { name: /^Actions / }).click();
    await expect(page.getByRole("menuitem", { name: COPY_ENTRY })).toBeVisible();
  } finally {
    writeFileSync(statePath, original);
  }
});
