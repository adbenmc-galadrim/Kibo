import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { EMIS_PROJECT } from "./fixtures/emis-maquettes";
import { captureContent } from "./pixel-content";
import { capturePixel, type Scheme } from "./pixel-kit";
import { PIXEL_MASKS } from "./pixel-masks";
import { type Box, decodePng } from "./pixel-report";
import { PIXEL_WIDTH } from "./pixel-settings";
import { captureProjectPages } from "./pixel-sidebar";

const HEIGHT = 1000;
const SCREEN = "planning";
const CONTENT: Box = { x: 241, y: 49, w: 1440 - 241, h: HEIGHT - 49 };
const MAX_RATIO = 0.02;
const DRAG_DELTA = { x: -206, y: 221 };
const OUT_DIR =
  process.env.KIBO_SCREENS_DIR ??
  join(import.meta.dirname, "..", "..", "..", "..", "screens", "2026-10-16-t8");

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function planningUrl(page: Page): Promise<string> {
  const projects = await rpc(page, { method: "listProjects" });
  const emis = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === EMIS_PROJECT.key);
  const projectId = text(emis, "id");
  const snapshot = await rpc(page, { method: "getProject", projectId });
  const holder = list(snapshot, "instances").find((i) => field(i, "component") === "planning@1.0.0");
  return `/#/p/${projectId}/${encodeURIComponent(text(holder, "pageId"))}`;
}

async function dragF9OverS44(page: Page): Promise<void> {
  const box = await page.getByRole("button", { name: /^F9 / }).boundingBox();
  if (!box) throw new Error("F9 card is not visible");
  const grab = { x: box.x + 10, y: box.y + box.height / 2 };
  await page.mouse.move(grab.x, grab.y);
  await page.mouse.down();
  await page.mouse.move(grab.x - 10, grab.y + 10, { steps: 4 });
  await page.mouse.move(grab.x + DRAG_DELTA.x, grab.y + DRAG_DELTA.y, { steps: 12 });
  await expect(page.getByText("Déposer pour planifier en S44")).toBeVisible();
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

function regionRatio(png: Uint8Array, box: Box): number {
  const { width, data } = decodePng(png);
  let differ = 0;
  for (let y = box.y; y < box.y + box.h; y++)
    for (let x = box.x; x < box.x + box.w; x++) {
      const i = (y * width + x) * 4;
      if (data[i] === 255 && data[i + 1] === 0 && data[i + 2] === 0) differ++;
    }
  return differ / (box.w * box.h);
}

const percent = (ratio: number): string => `${(ratio * 100).toFixed(3)} %`;

test("the Planning of Emis, F9 dragged over S44, matches the mockup on the whole screen", async ({
  page,
}, info) => {
  const scheme: Scheme = info.project.name === "pixel-light" ? "light" : "dark";
  await pairBrowser(page);
  await page.goto(await planningUrl(page));
  await expect(page.getByRole("region", { name: "S42 Terrain hors ligne" })).toBeVisible();
  const diffPath = join(OUT_DIR, `${SCREEN}-${scheme}-diff.png`);
  rmSync(diffPath, { force: true });
  await dragF9OverS44(page);
  let screenError: unknown = null;
  try {
    await capturePixel(page, {
      screen: SCREEN,
      scheme,
      height: HEIGHT,
      outDir: OUT_DIR,
      masks: PIXEL_MASKS.planning,
    });
  } catch (error) {
    screenError = error;
  }
  await page.mouse.up();
  const diff = existsSync(diffPath) ? readFileSync(diffPath) : null;
  if (screenError !== null && diff === null) throw screenError;
  const whole = diff ? regionRatio(diff, { x: 0, y: 0, w: 1440, h: HEIGHT }) : 0;
  const shell = diff ? regionRatio(diff, CONTENT) : 0;
  const pages = (await captureProjectPages(page, { screen: SCREEN, scheme, height: HEIGHT, outDir: OUT_DIR }))
    .ratio;
  await contentViewport(page);
  await dragF9OverS44(page);
  const contentShot = await captureContent(page, {
    screen: SCREEN,
    scheme,
    height: HEIGHT,
    region: CONTENT,
    root: page.locator("[data-view-body]"),
    masks: PIXEL_MASKS.planning,
    outDir: OUT_DIR,
  });
  await page.mouse.up();
  const content = contentShot.ratio;
  const zones = [...contentShot.boxes]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 15)
    .map((b) => `x=${b.x + CONTENT.x} y=${b.y + CONTENT.y} ${b.w}×${b.h}`);
  console.log(`[pixel] zones du contenu : ${zones.join(" ; ")}`);
  const line = `${scheme} : écran ${percent(whole)} (zone de contenu en place ${percent(shell)}), pages décalées ${percent(pages)}, contenu recalé ${percent(content)}`;
  info.annotations.push({ type: "pixel", description: line });
  console.log(`[pixel] ${SCREEN}-${line}`);
  expect(content).toBeLessThanOrEqual(MAX_RATIO);
  expect(whole).toBeLessThanOrEqual(MAX_RATIO);
  expect(pages).toBeLessThanOrEqual(MAX_RATIO);
  if (screenError !== null) throw screenError;
});
