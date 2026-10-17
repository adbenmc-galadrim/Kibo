import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser, rpc } from "./agents-seed";
import { captureContent } from "./pixel-content";
import { capturePixel, type Scheme } from "./pixel-kit";
import { PIXEL_MASKS } from "./pixel-masks";
import { type Box, decodePng } from "./pixel-report";
import { captureProjectPages } from "./pixel-sidebar";

const HEIGHT = 1000;
const SCREEN = "fonctionnalite";
const CONTENT: Box = { x: 241, y: 49, w: 1440 - 241, h: HEIGHT - 49 };
const MAX_RATIO = 0.02;
const OUT_DIR = process.env.KIBO_SCREENS_DIR ?? join(import.meta.dirname, "..", "screens", "2026-10-16-t9");

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

async function featureTarget(page: Page): Promise<string> {
  const projects = list(await rpc(page, { method: "listProjects" }));
  const emis = projects.find((p) => field(p, "key") === "EMIS");
  const projectId = field(emis, "id");
  if (typeof projectId !== "string") throw new Error("the emis-maquettes scenario has no Emis project");
  const project = await rpc(page, { method: "getProject", projectId });
  const f5 = list(field(project, "tickets")).find((t) => field(t, "shortKey") === "F5");
  const ticketId = field(f5, "id");
  if (typeof ticketId !== "string") throw new Error("Emis has no F5 feature");
  return `/#/p/${encodeURIComponent(projectId)}/t/${encodeURIComponent(ticketId)}`;
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

test("the feature sheet of F5 opened in a tab matches the mockup on the whole screen", async ({
  page,
}, info) => {
  const scheme: Scheme = info.project.name === "pixel-light" ? "light" : "dark";
  await pairBrowser(page);
  await page.goto(await featureTarget(page));
  await expect(
    page.getByRole("heading", { level: 1, name: "Envoyer les photos d'un tronçon" }),
  ).toBeVisible();
  const diffPath = join(OUT_DIR, `${SCREEN}-${scheme}-diff.png`);
  rmSync(diffPath, { force: true });
  let screenError: unknown = null;
  try {
    await capturePixel(page, {
      screen: SCREEN,
      scheme,
      height: HEIGHT,
      outDir: OUT_DIR,
      masks: PIXEL_MASKS.fonctionnalite,
    });
  } catch (error) {
    screenError = error;
  }
  const diff = existsSync(diffPath) ? readFileSync(diffPath) : null;
  if (screenError !== null && diff === null) throw screenError;
  const whole = diff ? regionRatio(diff, { x: 0, y: 0, w: 1440, h: HEIGHT }) : 0;
  const shell = diff ? regionRatio(diff, CONTENT) : 0;
  const pages = (await captureProjectPages(page, { screen: SCREEN, scheme, height: HEIGHT, outDir: OUT_DIR }))
    .ratio;
  const contentShot = await captureContent(page, {
    screen: SCREEN,
    scheme,
    height: HEIGHT,
    region: CONTENT,
    root: page.locator('[data-screen="feature"]'),
    masks: PIXEL_MASKS.fonctionnalite,
    outDir: OUT_DIR,
  });
  const content = contentShot.ratio;
  const zones = [...contentShot.boxes]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 15)
    .map((b) => `x=${b.x + CONTENT.x} y=${b.y + CONTENT.y} ${b.w}×${b.h}`);
  console.log(`[pixel] zones du contenu : ${zones.join(" ; ")}`);
  info.annotations.push({
    type: "pixel",
    description: `${scheme} : écran ${percent(whole)} (zone de contenu en place ${percent(shell)}), pages décalées ${percent(pages)}, contenu recalé ${percent(content)}`,
  });
  console.log(
    `[pixel] ${SCREEN}-${scheme} : écran ${percent(whole)} (zone de contenu en place ${percent(shell)}), pages décalées ${percent(pages)}, contenu recalé ${percent(content)}`,
  );
  expect(content).toBeLessThanOrEqual(MAX_RATIO);
  expect(whole).toBeLessThanOrEqual(MAX_RATIO);
  expect(pages).toBeLessThanOrEqual(MAX_RATIO);
  if (screenError !== null) throw screenError;
});
