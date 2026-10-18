import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, openPixelPage, type Phase, screensDir } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { siloComponentUrl } from "./pixel-silo";

const HEIGHT = 1000;
const CONTENT = contentBox(241, HEIGHT);
const DROP_INSET_X = 40;
const DROP_DOWN_Y = 221;

async function dragF9OverS44(page: Page): Promise<void> {
  const box = await page.getByRole("button", { name: /^F9 / }).boundingBox();
  const s44 = await page.getByRole("region", { name: /^S44 / }).boundingBox();
  if (!box || !s44) throw new Error("F9 card or S44 is not visible");
  const grab = { x: box.x + 10, y: box.y + box.height / 2 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x + 10, grab.y + 10, { steps: 4 });
  await page.mouse.move(s44.x + DROP_INSET_X, grab.y + DROP_DOWN_Y, { steps: 12 });
  await expect(page.getByText("Déposer pour planifier en S44")).toBeVisible();
}

async function cancelDrag(page: Page): Promise<void> {
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.getByText("Déposer pour planifier en S44")).toBeHidden();
}

async function contentViewport(page: Page): Promise<void> {
  const placed = await page.locator("[data-view-body]").boundingBox();
  if (!placed) throw new Error("the content root is not on screen");
  await page.setViewportSize({
    width: PIXEL_WIDTH + Math.round(placed.x) - CONTENT.x,
    height: HEIGHT + Math.round(placed.y) - CONTENT.y,
  });
  await expect(page.getByRole("button", { name: /^F9 / })).toBeVisible();
}

async function pose(page: Page, phase: Phase): Promise<void> {
  if (phase === "content") await contentViewport(page);
  await dragF9OverS44(page);
}

test("the Planning of Silo, F9 dragged over S44, matches the mockup on the whole screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: HEIGHT });
  await pairBrowser(page);
  await openPixelPage(page, await siloComponentUrl(page, "planning@1.0.0"), HEIGHT);
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
  await measureScreen(page, {
    screen: "planning",
    height: HEIGHT,
    masks: PIXEL_MASKS.planning,
    content: CONTENT,
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-17-t16"),
    pose,
    release: cancelDrag,
  });
});
