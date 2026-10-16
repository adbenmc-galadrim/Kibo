import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser, rpc } from "./agents-seed";
import { captureContent } from "./pixel-content";
import { capturePixel, type Scheme } from "./pixel-kit";
import { PIXEL_MASKS } from "./pixel-masks";
import { type Box, decodePng } from "./pixel-report";

const HEIGHT = 1000;
const SCREEN = "tickets";
const CONTENT: Box = { x: 241, y: 49, w: 1440 - 241, h: HEIGHT - 49 };
const MAX_CONTENT_RATIO = 0.02;
const OUT_DIR =
  process.env.KIBO_SCREENS_DIR ??
  join(import.meta.dirname, "..", "..", "..", "..", "screens", "2026-10-16-t10");

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

async function ticketsPage(page: Page): Promise<string> {
  const projects = list(await rpc(page, { method: "listProjects" }));
  const projectId = field(
    projects.find((p) => field(p, "key") === "EMIS"),
    "id",
  );
  if (typeof projectId !== "string") throw new Error("the emis-maquettes scenario has no Emis project");
  const project = await rpc(page, { method: "getProject", projectId });
  const pageId = field(
    list(field(project, "pages")).find((p) => field(p, "title") === "Tickets"),
    "id",
  );
  if (typeof pageId !== "string") throw new Error("Emis has no Tickets page");
  return `/#/p/${encodeURIComponent(projectId)}/${encodeURIComponent(pageId)}`;
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

test("the Tickets page of Emis on sprint S42 matches the mockup in its content area", async ({
  page,
}, info) => {
  const scheme: Scheme = info.project.name === "pixel-light" ? "light" : "dark";
  const diffPath = join(OUT_DIR, `${SCREEN}-${scheme}-diff.png`);
  rmSync(diffPath, { force: true });
  await pairBrowser(page);
  await page.goto(await ticketsPage(page));
  const s42 = page.getByRole("tablist", { name: "Sprint affiché" }).getByRole("tab", { name: /S42$/ });
  await expect(s42).toBeVisible();
  if ((await s42.getAttribute("aria-selected")) !== "true") await s42.click();
  await expect(s42).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText("Écran d'envoi hors ligne")).toBeVisible();
  await page.mouse.move(0, HEIGHT - 1);
  await page.evaluate(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined,
  );
  let screenError: unknown = null;
  try {
    await capturePixel(page, {
      screen: SCREEN,
      scheme,
      height: HEIGHT,
      outDir: OUT_DIR,
      masks: PIXEL_MASKS.tickets,
    });
  } catch (error) {
    screenError = error;
  }
  const diff = existsSync(diffPath) ? readFileSync(diffPath) : null;
  if (screenError !== null && diff === null) throw screenError;
  const whole = diff ? regionRatio(diff, { x: 0, y: 0, w: 1440, h: HEIGHT }) : 0;
  const shell = diff ? regionRatio(diff, CONTENT) : 0;
  const contentShot = await captureContent(page, {
    screen: SCREEN,
    scheme,
    height: HEIGHT,
    region: CONTENT,
    root: page.locator("[data-view-body]"),
    masks: PIXEL_MASKS.tickets,
    outDir: OUT_DIR,
  });
  const content = contentShot.ratio;
  const zones = [...contentShot.boxes]
    .sort((a, b) => b.w * b.h - a.w * a.h)
    .slice(0, 15)
    .map((b) => `x=${b.x + CONTENT.x} y=${b.y + CONTENT.y} ${b.w}×${b.h}`);
  console.log(`[pixel] zones du contenu : ${zones.join(" ; ")}`);
  const line = `${scheme} : écran ${percent(whole)} (zone de contenu en place ${percent(shell)}), contenu recalé ${percent(content)}`;
  info.annotations.push({ type: "pixel", description: line });
  console.log(`[pixel] ${SCREEN}-${line}`);
  if (screenError !== null)
    console.log(
      `[pixel] écran entier au-dessus du seuil (coque de T11) : ${String(screenError).split("\n")[1]}`,
    );
  expect(content).toBeLessThanOrEqual(MAX_CONTENT_RATIO);
});
