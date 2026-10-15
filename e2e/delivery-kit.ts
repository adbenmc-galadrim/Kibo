import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Browser, expect, type Page, type TestInfo } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { homeOf } from "./e2e-home";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { WIDE } from "./visibility-kit";

type Row = { title: string; status: string; parent?: number };

const DONE = [
  "Connexion par lien magique",
  "Gabarit des courriels",
  "Journal des connexions",
  "Export CSV des inscrits",
  "Page d'accueil des élèves",
  "Rôles enseignant et élève",
  "Pagination de la liste des cours",
  "Recherche dans les cours",
  "Notifications par courriel",
  "Paramètres du compte",
  "Mot de passe oublié",
  "Thème sombre",
  "Traductions de l'espace élève",
  "Tableau de bord enseignant",
];

const ROWS: Row[] = [
  ...DONE.map((title) => ({ title, status: "done" })),
  { title: "Écran « Accès refusé »", status: "todo" },
  { title: "Tests du module de paiement", status: "todo" },
  { title: "Comptes clients (C2)", status: "todo" },
  { title: "C2-1 · Liste des comptes", status: "todo", parent: 17 },
  { title: "C2-2 · Fiche d'un compte", status: "todo", parent: 17 },
  { title: "C2-3 · Modèle des comptes", status: "done", parent: 17 },
  { title: "C2-4 · Export des comptes", status: "todo", parent: 17 },
];

export type Emis = {
  page: Page;
  info: TestInfo;
  projectId: string;
  board: string;
  questions: string;
  tickets: Map<string, string>;
  reviewer: string;
  repo: E2eRepo;
};

export type DeliveryRun = { id: string; sessionId: string; state: string; turns: number };

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const command = (page: Page, projectId: string, cmd: Record<string, unknown>) =>
  rpc(page, { method: "command", projectId, command: cmd });

async function createAgent(page: Page, name: string, description: string): Promise<string> {
  const created = await rpc(page, {
    method: "agents.create",
    scope: "global",
    name,
    description,
    template: "blank",
  });
  const ref = text(field(created, "agent"), "ref");
  await rpc(page, { method: "agents.settings", ref, patch: { maxParallel: 3 } });
  return ref;
}

async function seedTickets(page: Page, projectId: string): Promise<Map<string, string>> {
  const tickets = new Map<string, string>();
  for (const [index, row] of ROWS.entries()) {
    const parentId = row.parent === undefined ? null : (tickets.get(`EMIS-${row.parent}`) ?? null);
    const cmd = { method: "createTicket", title: row.title, statusId: row.status, parentId };
    tickets.set(`EMIS-${index + 1}`, text(await command(page, projectId, cmd), "id"));
  }
  const link = {
    method: "addLink",
    from: tickets.get("EMIS-19"),
    to: tickets.get("EMIS-21"),
    type: "blocks",
  };
  await command(page, projectId, link);
  return tickets;
}

async function addView(page: Page, projectId: string, title: string, component: string): Promise<string> {
  const pageId = text(await command(page, projectId, { method: "addPage", title, kind: "view" }), "id");
  await command(page, projectId, { method: "addInstance", pageId, component });
  return pageId;
}

const PROFILE = ["# Emis", "", "## Autorisations", "", "- `Bash(pnpm *)`", "- `Bash(docker compose *)`"];

function writeRegistry(info: TestInfo, repo: E2eRepo): void {
  const root = join(homeOf(info), "delivery", "emis");
  mkdirSync(join(root, "memory"), { recursive: true });
  writeFileSync(join(root, "profile.md"), [...PROFILE, "", "## Publication", "", "draft", ""].join("\n"));
  writeFileSync(join(repo.repo, ".env.local"), "PORT=4800\n");
  const entry = {
    root: "~/delivery/emis",
    repo: repo.repo,
    base: "main",
    profile: "~/delivery/emis/profile.md",
    memory: "~/delivery/emis/memory/MEMORY.md",
    plan: { idPattern: "^C\\d+-\\d+$" },
    worktree: {
      dir: `${repo.repo}-{dashed}`,
      copyFrom: ["{repo}"],
      copy: [".env.local"],
      env: { file: ".env.local", ports: { keys: { PORT: 4800 }, from: 1, step: 10, count: 20 } },
      after: ["git status --short"],
    },
  };
  writeFileSync(join(homeOf(info), "registry.json"), JSON.stringify({ projects: { emis: entry } }));
}

export const skillsDir = (info: TestInfo) => join(homeOf(info), ".claude", "skills");

export async function openEmis(browser: Browser, info: TestInfo): Promise<Emis> {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: WIDE });
  const page = await context.newPage();
  await pairBrowser(page);
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  mkdirSync(join(skillsDir(info), "full-delivery", "reference"), { recursive: true });
  const repo = createE2eRepo("EMIS");
  writeRegistry(info, repo);
  const created = await rpc(page, {
    method: "createProject",
    name: "Emis",
    key: "EMIS",
    folder: repo.repo,
    color: "#F97316",
  });
  const projectId = text(created, "id");
  const board = await addView(page, projectId, "Kanban", "kanban@1.0.0");
  const questions = await addView(page, projectId, "Questions", "questions@1.0.0");
  const tickets = await seedTickets(page, projectId);
  await createAgent(page, "full-delivery", "Livre un ticket de bout en bout");
  const reviewer = await createAgent(page, "relecture", "Relit une branche et rend ses remarques");
  return { page, info, projectId, board, questions, tickets, reviewer, repo };
}

const runOf = (row: unknown): DeliveryRun => ({
  id: String(field(row, "id")),
  sessionId: String(field(row, "sessionId") ?? ""),
  state: String(field(row, "state")),
  turns: Number(field(row, "turns") ?? 0),
});

async function runsOf(e: Emis, key: string): Promise<DeliveryRun[]> {
  const rows = list(await rpc(e.page, { method: "getAgents" }), "runs");
  return rows.filter((r) => field(r, "ticketKey") === key).map(runOf);
}

export async function runCount(e: Emis): Promise<number> {
  return list(await rpc(e.page, { method: "getAgents" }), "runs").length;
}

export async function runFor(e: Emis, key: string): Promise<DeliveryRun> {
  await expect
    .poll(async () => (await runsOf(e, key)).at(-1)?.sessionId ?? "", { timeout: 30_000 })
    .not.toBe("");
  const run = (await runsOf(e, key)).at(-1);
  if (!run) throw new Error(`no run for ${key}`);
  return run;
}

export async function settled(e: Emis, key: string, turns: number): Promise<void> {
  await expect
    .poll(
      async () => {
        const run = (await runsOf(e, key)).at(-1);
        return run && run.turns >= turns ? run.state : "";
      },
      { timeout: 45_000 },
    )
    .toBe("done");
}

export async function subagentStates(e: Emis, runId: string): Promise<string[]> {
  const rows = await rpc(e.page, { method: "runs.subagents", runId });
  return (Array.isArray(rows) ? rows : []).map(
    (s) => `${String(field(s, "description"))}:${String(field(s, "state"))}`,
  );
}

export const release = (e: Emis, run: DeliveryRun) =>
  writeFileSync(join(homeOf(e.info), "claude", "projects", `${run.sessionId}.release`), "");

type Slot = { lock: string; dir: "held" | "wait"; label: string; minutes: number };

const SLOTS: Slot[] = [
  { lock: "heavy", dir: "held", label: "emis:EMIS-18 gates", minutes: 4 },
  { lock: "heavy", dir: "held", label: "emis:EMIS-19 gates", minutes: 2 },
  { lock: "heavy", dir: "wait", label: "kibo:KIB-28 gates", minutes: 1 },
  { lock: "playwright", dir: "held", label: "emis:EMIS-18 e2e", minutes: 3 },
];

export function holdSlots(e: Emis): void {
  const root = join(homeOf(e.info), "slots");
  const now = Math.floor(Date.now() / 1000);
  for (const [index, slot] of SLOTS.entries()) {
    const dir = join(root, slot.lock, slot.dir);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(root, slot.lock, "max"), slot.lock === "heavy" ? "2" : "1");
    const ticket = {
      pid: process.pid,
      since: now - slot.minutes * 60,
      label: slot.label,
      cwd: e.repo.repo,
      ticket: `${index}-${process.pid}`,
    };
    writeFileSync(join(dir, `${index}.json`), JSON.stringify(ticket));
  }
}

export const ticketPath = (e: Emis, key: string) => `/#/p/${e.projectId}/t/${e.tickets.get(key) ?? ""}`;

export async function openBoard(e: Emis): Promise<void> {
  await e.page.goto(`/#/p/${e.projectId}/${e.board}`);
  await e.page.getByText("Tous", { exact: true }).click();
  await expect(e.page.getByRole("article", { name: /^EMIS-15 / })).toBeVisible();
}

export async function deliverFromBoard(e: Emis, key: string): Promise<void> {
  await e.page.getByRole("button", { name: `Actions ${key}` }).click();
  await e.page.getByRole("menuitem", { name: "Livrer" }).click();
}

export async function openQuestions(e: Emis): Promise<void> {
  await e.page.goto(`/#/p/${e.projectId}/${e.questions}`);
  await expect(e.page.getByRole("radiogroup", { name: "État" })).toBeVisible();
}

export async function openProjectSettings(e: Emis): Promise<void> {
  await e.page.getByRole("button", { name: "Actions de Emis" }).click();
  await e.page.getByRole("menuitem", { name: "Modifier…" }).click();
  await expect(e.page.getByRole("dialog", { name: "Modifier le projet" })).toBeVisible();
}
