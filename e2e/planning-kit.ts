import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { homeOf } from "./e2e-home";
import { EMIS_PROJECT } from "./fixtures/emis-maquettes";
import { createE2eRepo, type E2eRepo } from "./git-repo";

const CLI = join(import.meta.dirname, "..", "packages", "cli", "src", "bin.ts");

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export type Emis = {
  projectId: string;
  pageUrl(component: string): string;
  ticketUrl(keyLabel: string): string;
};

export async function loadEmis(page: Page): Promise<Emis> {
  const projects = await rpc(page, { method: "listProjects" });
  const found = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === EMIS_PROJECT.key);
  const projectId = text(found, "id");
  const snapshot = await rpc(page, { method: "getProject", projectId });
  const pages = new Map(list(snapshot, "instances").map((i) => [text(i, "component"), text(i, "pageId")]));
  const tickets = new Map(list(snapshot, "tickets").map((t) => [text(t, "keyLabel"), text(t, "id")]));
  const pick = (map: Map<string, string>, wanted: string): string => {
    const id = map.get(wanted);
    if (id === undefined) throw new Error(`Emis has no ${wanted}`);
    return id;
  };
  return {
    projectId,
    pageUrl: (component) => `/#/p/${projectId}/${encodeURIComponent(pick(pages, component))}`,
    ticketUrl: (keyLabel) => `/#/p/${projectId}/t/${encodeURIComponent(pick(tickets, keyLabel))}`,
  };
}

export async function ticketId(page: Page, emis: Emis, keyLabel: string): Promise<string> {
  const snapshot = await rpc(page, { method: "getProject", projectId: emis.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "keyLabel") === keyLabel);
  return text(ticket, "id");
}

export async function setStatus(page: Page, emis: Emis, keyLabel: string, statusId: string): Promise<void> {
  const id = await ticketId(page, emis, keyLabel);
  await rpc(page, {
    method: "command",
    projectId: emis.projectId,
    command: { method: "setStatus", ticketId: id, statusId },
  });
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("the element is not on screen");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export async function dragOnto(page: Page, card: Locator, target: Locator, hint: Locator): Promise<void> {
  const from = await center(card);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x - 10, from.y + 10, { steps: 4 });
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await expect(hint).toBeVisible();
  await page.mouse.up();
}

export function kiboCli(info: TestInfo, args: readonly string[]): string {
  return execFileSync("bun", [CLI, ...args], {
    env: { ...process.env, KIBO_HOME: homeOf(info) },
    encoding: "utf8",
  });
}

async function code(page: Page, body: Record<string, unknown>): Promise<unknown> {
  const payload = await page.evaluate(async (request) => {
    const res = await fetch("/api/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const json: unknown = await res.json();
    return json;
  }, body);
  if (field(payload, "ok") !== true)
    throw new Error(`code ${String(body.method)}: ${JSON.stringify(payload)}`);
  return field(payload, "result");
}

export async function attachRepo(page: Page, emis: Emis): Promise<E2eRepo> {
  const repo = createE2eRepo("planning");
  await rpc(page, { method: "updateProject", projectId: emis.projectId, patch: { folder: repo.repo } });
  const worktrees = await code(page, { method: "worktrees", projectId: emis.projectId });
  const main = (Array.isArray(worktrees) ? worktrees : []).find((w) => field(w, "isMain") === true);
  await code(page, { method: "status", projectId: emis.projectId, worktree: text(main, "path") });
  return repo;
}

export function createBranch(repo: E2eRepo, branch: string): void {
  repo.git("branch", branch, "main");
}

export async function clipboardText(page: Page): Promise<string> {
  return page.evaluate(() => navigator.clipboard.readText());
}
