import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { homeOf } from "./e2e-home";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { createRepoProject } from "./repo-project";
import { WIDE } from "./visibility-kit";

export const OWNER = "BOU-12";
export const OTHER = "BOU-15";
export const SHELL = "BOU-16";
export const KEEPER = "BOU-17";

const TITLES = new Map([
  [OWNER, "Format des dates de livraison"],
  [OTHER, "Page de suivi de commande"],
  [SHELL, "Date d'expédition par le shell"],
  [KEEPER, "Date du colis gardée en copie"],
]);

export type Boutique = {
  page: Page;
  info: TestInfo;
  projectId: string;
  tickets: Map<string, string>;
  agent: string;
  repo: E2eRepo;
};

export type HeldRun = { id: string; sessionId: string; label: string };

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const fakeState = (b: Boutique, file: string) => join(homeOf(b.info), "claude", "projects", file);

function writesOf(b: Boutique, run: HeldRun): number {
  const file = fakeState(b, `${run.sessionId}.writes.jsonl`);
  if (!existsSync(file)) return 0;
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.length > 0).length;
}

async function projectIdOf(page: Page, key: string): Promise<string> {
  const projects = await rpc(page, { method: "listProjects" });
  const found = (Array.isArray(projects) ? projects : []).find((p) => field(p, "key") === key);
  return text(found, "id");
}

async function createLivraison(page: Page, projectId: string): Promise<string> {
  const created = await rpc(page, {
    method: "agents.create",
    scope: "project",
    projectId,
    name: "livraison",
    description: "Livre un ticket en TDD avec des commits propres",
    model: "opus",
  });
  const ref = text(field(created, "agent"), "ref");
  await rpc(page, { method: "agents.list", projectId });
  const patch = { permissionMode: "acceptEdits", workspace: "worktree", maxParallel: 3 };
  await rpc(page, { method: "agents.settings", ref, patch });
  return ref;
}

export async function openBoutique(browser: Browser, info: TestInfo): Promise<Boutique> {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: WIDE });
  const page = await context.newPage();
  await pairBrowser(page);
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  const repo = createE2eRepo("BOU");
  await createRepoProject(page, "Boutique", "BOU", repo.repo);
  const projectId = await projectIdOf(page, "BOU");
  const tickets = new Map<string, string>();
  for (let n = 1; n <= 17; n += 1) {
    const key = `BOU-${n}`;
    const command = { method: "createTicket", title: TITLES.get(key) ?? `Ticket ${n}`, statusId: "todo" };
    tickets.set(key, text(await rpc(page, { method: "command", projectId, command }), "id"));
  }
  return { page, info, projectId, tickets, agent: await createLivraison(page, projectId), repo };
}

async function runOf(b: Boutique, runId: string): Promise<unknown> {
  const runs = list(await rpc(b.page, { method: "getAgents" }), "runs");
  return runs.find((r) => field(r, "id") === runId);
}

export async function stateOf(b: Boutique, runId: string): Promise<string> {
  return String(field(await runOf(b, runId), "state") ?? "");
}

export async function assign(b: Boutique, key: string): Promise<HeldRun> {
  const run = await rpc(b.page, {
    method: "assignAgent",
    projectId: b.projectId,
    ticketId: b.tickets.get(key),
    profileId: b.agent,
    brief: "",
  });
  const id = text(run, "id");
  await expect.poll(async () => String(field(await runOf(b, id), "sessionId") ?? "")).not.toBe("");
  const found = await runOf(b, id);
  return { id, sessionId: text(found, "sessionId"), label: text(found, "label") };
}

export async function wrote(b: Boutique, run: HeldRun, count: number): Promise<void> {
  await expect.poll(() => writesOf(b, run), { timeout: 45_000 }).toBeGreaterThanOrEqual(count);
}

export async function finished(b: Boutique, run: HeldRun): Promise<void> {
  await expect.poll(() => stateOf(b, run.id), { timeout: 45_000 }).toBe("done");
}

export const release = (b: Boutique, run: HeldRun) =>
  writeFileSync(fakeState(b, `${run.sessionId}.release`), "");

export async function overlapStates(b: Boutique, runId: string): Promise<string[]> {
  const rows = await rpc(b.page, { method: "overlaps.list", projectId: b.projectId, runId });
  return (Array.isArray(rows) ? rows : []).map(
    (o) => `${String(field(o, "key"))}:${String(field(o, "status"))}`,
  );
}

export async function autoLinkStates(b: Boutique): Promise<string[]> {
  const rows = await rpc(b.page, { method: "autoLinks.list", projectId: b.projectId });
  return (Array.isArray(rows) ? rows : []).map(
    (l) => `${String(field(l, "reason"))}:${String(field(l, "status"))}`,
  );
}

export async function openTotal(b: Boutique): Promise<number> {
  return Number(field(await rpc(b.page, { method: "getAgents" }), "overlapTotal") ?? 0);
}
