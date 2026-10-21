import { expect, type Page } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { SILO_PROJECT } from "./fixtures/silo-maquettes";
import { openPixelPage } from "./pixel-screen";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

type Silo = { projectId: string; snapshot: unknown };

async function silo(page: Page): Promise<Silo> {
  const projects = await rpc(page, { method: "listProjects" });
  const found = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === SILO_PROJECT.key);
  if (found === undefined) throw new Error("the silo-maquettes scenario has no Silo project");
  const projectId = text(found, "id");
  return { projectId, snapshot: await rpc(page, { method: "getProject", projectId }) };
}

const route = (projectId: string, rest: string): string => `/#/p/${encodeURIComponent(projectId)}/${rest}`;

export async function siloPageUrl(page: Page, title: string): Promise<string> {
  const { projectId, snapshot } = await silo(page);
  const found = list(snapshot, "pages").find((p) => field(p, "title") === title);
  if (found === undefined) throw new Error(`Silo has no page « ${title} »`);
  return route(projectId, encodeURIComponent(text(found, "id")));
}

export async function siloComponentUrl(page: Page, component: string): Promise<string> {
  const { projectId, snapshot } = await silo(page);
  const holder = list(snapshot, "instances").find((i) => field(i, "component") === component);
  if (holder === undefined) throw new Error(`Silo has no instance of ${component}`);
  return route(projectId, encodeURIComponent(text(holder, "pageId")));
}

export async function siloFeatureUrl(page: Page, shortKey: string): Promise<string> {
  const { projectId, snapshot } = await silo(page);
  const found = list(snapshot, "tickets").find((t) => field(t, "shortKey") === shortKey);
  if (found === undefined) throw new Error(`Silo has no ${shortKey} feature`);
  return route(projectId, `t/${encodeURIComponent(text(found, "id"))}`);
}

export async function openSiloOverviewAgent(page: Page, height: number): Promise<void> {
  await pairBrowser(page);
  await openPixelPage(page, await siloPageUrl(page, "Vue d'ensemble"), height);
  await expect(page.getByText("2 sessions T3 Code")).toBeVisible();
  await page.getByRole("button", { name: /^Agent de projet/ }).click();
  await expect(page.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
}
