import { expect, type Page, test } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { EMIS_PROJECT } from "./fixtures/emis-maquettes";
import { capturePixel, preparePixelPage, type Scheme } from "./pixel-kit";
import { PIXEL_MASKS } from "./pixel-masks";

const HEIGHT = 1000;
const DRAG_DELTA = { x: -206, y: 221 };

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

test("P2 Planning matches the mockup, F9 dragged over S44", async ({ page }) => {
  const scheme: Scheme = test.info().project.use.colorScheme === "light" ? "light" : "dark";
  await preparePixelPage(page, { scheme, height: HEIGHT });
  await pairBrowser(page);
  await page.goto(await planningUrl(page));
  await expect(page.getByRole("region", { name: "S42 Terrain hors ligne" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^F9 / })).toBeVisible();
  await dragF9OverS44(page);
  const result = await capturePixel(page, {
    screen: "planning",
    scheme,
    height: HEIGHT,
    outDir: test.info().outputPath("screens"),
    masks: PIXEL_MASKS.planning,
  });
  await page.mouse.up();
  expect(result.report.ratio).toBeLessThanOrEqual(0.02);
});
