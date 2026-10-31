import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import {
  contentBox,
  measureScreen,
  openPixelPage,
  schemeOf,
  screensDir,
  settlePointer,
} from "./pixel-screen";

const HEIGHT = 1000;
const OUT = screensDir("2026-10-31-p34-t6");

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function openToday(page: Page): Promise<void> {
  await pairBrowser(page);
  await openPixelPage(page, "/#/", HEIGHT);
  await page.getByRole("button", { name: "Aujourd'hui", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Aujourd'hui", exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByText("Nimbus")).toBeVisible();
}

async function capture(page: Page, name: string): Promise<void> {
  mkdirSync(OUT, { recursive: true });
  const scheme = schemeOf(test.info().project.name);
  await settlePointer(page, HEIGHT);
  await page.screenshot({ path: join(OUT, `2026-10-31-p34-t6-${name}-${scheme}.png`) });
}

type Patch = (method: unknown, result: unknown) => unknown;

async function patchRpc(page: Page, patch: Patch): Promise<void> {
  await page.route("**/api/rpc", async (route) => {
    const method = field(route.request().postDataJSON(), "method");
    const response = await route.fetch();
    const payload: unknown = await response.json();
    await route.fulfill({ response, json: { ok: true, result: patch(method, field(payload, "result")) } });
  });
}

const onlyNimbus: Patch = (method, result) =>
  method === "listProjects" && Array.isArray(result)
    ? result.filter((p) => field(p, "key") === "NIM")
    : result;

const blockedKibo = (tickets: unknown): unknown =>
  Array.isArray(tickets)
    ? tickets.map((t) =>
        field(t, "statusId") === "done" ? { ...t, statusId: "blocked", blockedReason: "serveur" } : t,
      )
    : tickets;

const blockWork: Patch = (method, result) =>
  method === "getProject" && field(field(result, "meta"), "key") === "KIB"
    ? { ...(result as object), tickets: blockedKibo(field(result, "tickets")) }
    : result;

test("Aujourd'hui matches the mockup", async ({ page }) => {
  await openToday(page);
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "p34-aujourdhui",
    height: HEIGHT,
    masks: [],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: OUT,
    contentInformative: true,
  });
});

test("Aujourd'hui, the whole of a long section and the calm line", async ({ page }) => {
  await patchRpc(page, blockWork);
  await openToday(page);
  const blocking = page.getByRole("region", { name: "Ce qui bloque" });
  await capture(page, "replie");
  await blocking.getByRole("button", { name: /^Tout voir/ }).click();
  await expect(blocking.getByRole("listitem").nth(5)).toBeVisible();
  await capture(page, "tout-voir");
  await page.unroute("**/api/rpc");
  await patchRpc(page, onlyNimbus);
  await page.goto("/#/");
  await page.reload();
  await expect(page.getByText("Rien ne bloque, rien à relire, rien à démarrer.")).toBeVisible();
  await capture(page, "calme");
});
