import type { Page } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { EMIS_PROJECT } from "./fixtures/emis-maquettes";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

type Emis = { projectId: string; snapshot: unknown };

async function emis(page: Page): Promise<Emis> {
  const projects = await rpc(page, { method: "listProjects" });
  const found = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === EMIS_PROJECT.key);
  if (found === undefined) throw new Error("the emis-maquettes scenario has no Emis project");
  const projectId = text(found, "id");
  return { projectId, snapshot: await rpc(page, { method: "getProject", projectId }) };
}

const route = (projectId: string, rest: string): string => `/#/p/${encodeURIComponent(projectId)}/${rest}`;

export async function emisPageUrl(page: Page, title: string): Promise<string> {
  const { projectId, snapshot } = await emis(page);
  const found = list(snapshot, "pages").find((p) => field(p, "title") === title);
  if (found === undefined) throw new Error(`Emis has no page « ${title} »`);
  return route(projectId, encodeURIComponent(text(found, "id")));
}

export async function emisComponentUrl(page: Page, component: string): Promise<string> {
  const { projectId, snapshot } = await emis(page);
  const holder = list(snapshot, "instances").find((i) => field(i, "component") === component);
  if (holder === undefined) throw new Error(`Emis has no instance of ${component}`);
  return route(projectId, encodeURIComponent(text(holder, "pageId")));
}

export async function emisFeatureUrl(page: Page, shortKey: string): Promise<string> {
  const { projectId, snapshot } = await emis(page);
  const found = list(snapshot, "tickets").find((t) => field(t, "shortKey") === shortKey);
  if (found === undefined) throw new Error(`Emis has no ${shortKey} feature`);
  return route(projectId, `t/${encodeURIComponent(text(found, "id"))}`);
}
