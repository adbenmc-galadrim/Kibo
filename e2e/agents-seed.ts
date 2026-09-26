import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, type Page } from "@playwright/test";

type Body = Record<string, unknown>;
type Status = "backlog" | "todo" | "in_progress" | "in_review" | "blocked" | "done";
type Row = {
  n: number;
  title: string;
  parent?: number;
  status: Status;
  domain: string;
  mine?: boolean;
  reason?: string;
};

const TICKETS: Row[] = [
  { n: 3, title: "Noyau de données", status: "in_progress", domain: "Core" },
  { n: 4, title: "Orchestration des agents", status: "in_progress", domain: "Agents" },
  { n: 5, title: "Monorepo Bun workspaces", status: "done", domain: "DevOps", mine: true },
  { n: 6, title: "UI de base", status: "in_progress", domain: "UI" },
  { n: 7, title: "Tokens shadcn + thème sombre", parent: 6, status: "in_review", domain: "UI", mine: true },
  { n: 9, title: "Setup Tauri + sidecar Bun", status: "todo", domain: "DevOps", mine: true },
  { n: 10, title: "Watcher git et gh", status: "in_progress", domain: "Agents" },
  { n: 11, title: "Démon : auth par jeton local", status: "in_review", domain: "Sécurité", mine: true },
  { n: 12, title: "Schéma Loro des tickets (LoroTree)", parent: 3, status: "in_progress", domain: "Core" },
  { n: 13, title: "Snapshots Loro ↔ SQLite", parent: 3, status: "done", domain: "Core", mine: true },
  { n: 14, title: "Récepteur de hooks Claude Code", parent: 4, status: "in_progress", domain: "Agents" },
  {
    n: 15,
    title: "Kanban : drag & drop entre colonnes",
    parent: 6,
    status: "todo",
    domain: "UI",
    mine: true,
  },
  { n: 16, title: "Moteur de règles déclaratif", parent: 4, status: "in_progress", domain: "Agents" },
  { n: 18, title: "Adaptateur GitHub Issues", status: "todo", domain: "Intégrations" },
  {
    n: 21,
    title: "Sandbox iframe des composants",
    status: "blocked",
    domain: "Sécurité",
    mine: true,
    reason: "Audit sécurité externe en attente",
  },
  { n: 22, title: "Export Markdown / Obsidian", status: "backlog", domain: "Intégrations", mine: true },
  { n: 24, title: "Types Zod Ticket / Link / Status", parent: 12, status: "done", domain: "Core" },
  { n: 25, title: "Opérations move / reparent", parent: 12, status: "done", domain: "Core" },
  { n: 26, title: "Index SQLite dérivé", parent: 12, status: "done", domain: "Core" },
  {
    n: 27,
    title: "Tests de convergence (fast-check)",
    parent: 12,
    status: "in_progress",
    domain: "Core",
  },
  {
    n: 28,
    title: "Générateur d'opérations concurrentes",
    parent: 27,
    status: "in_progress",
    domain: "Core",
  },
  { n: 29, title: "Migration v0 → v1", parent: 12, status: "todo", domain: "Core" },
];

const BLOCKS: [number, number][] = [
  [5, 12],
  [13, 12],
  [12, 15],
  [11, 21],
  [21, 22],
  [16, 22],
];

const DOMAINS: [string, string][] = [
  ["Core", "#14B8A6"],
  ["Agents", "#6366F1"],
  ["UI", "#EC4899"],
  ["Sécurité", "#B45309"],
  ["DevOps", "#64748B"],
  ["Intégrations", "#84CC16"],
  ["Facturation", "#D946EF"],
];

const CORE_GUIDELINES: [string, string][] = [
  [
    "guidelines/core.md",
    [
      "# Guidelines — domaine Core",
      "",
      "- Toute entité partagée a un schéma Zod dans packages/core/schema.",
      "- Les arbres (tickets, pages) utilisent LoroTree ; jamais de parentId manuel.",
      "- Toute mutation passe par une commande du démon, jamais par l'UI directe.",
      "- Tests de convergence obligatoires pour une nouvelle opération CRDT.",
      "",
      "## À ne pas faire",
      "- Écrire un état d'agent depuis un LLM.",
      "- Stocker un secret dans un doc Loro.",
    ].join("\n"),
  ],
  ["skills/loro-patterns.md", "# Patterns Loro\n\n- Un doc par projet."],
  ["guidelines/tests.md", "# Tests\n\n- fast-check pour le CRDT."],
];

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export function text(value: unknown, key: string): string {
  const found = field(value, key);
  if (typeof found !== "string") throw new Error(`${key} is not a string in ${JSON.stringify(value)}`);
  return found;
}

export function list(value: unknown, key: string): unknown[] {
  const found = field(value, key);
  if (!Array.isArray(found)) throw new Error(`${key} is not a list`);
  return found;
}

export async function rpc(page: Page, body: Body): Promise<unknown> {
  const payload = await page.evaluate(async (request) => {
    const res = await fetch("/api/rpc", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
    });
    const json: unknown = await res.json();
    return json;
  }, body);
  if (field(payload, "ok") !== true)
    throw new Error(`rpc ${String(body.method)}: ${JSON.stringify(payload)}`);
  return field(payload, "result");
}

export function createGitRepo(): string {
  const dir = mkdtempSync(join(tmpdir(), "kibo-e2e-repo-"));
  const git = (...args: string[]) => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  git("init", "-q", "-b", "main");
  writeFileSync(join(dir, "README.md"), "# Kibo\n");
  git("add", "README.md");
  git("-c", "user.name=Kibo E2E", "-c", "user.email=e2e@kibo.local", "commit", "-q", "-m", "init");
  return dir;
}

const config = (page: Page, command: Body) => rpc(page, { method: "config", command });

async function seedConfig(page: Page): Promise<Map<string, string>> {
  const domains = new Map<string, string>();
  for (const [name, color] of DOMAINS) {
    const created = await config(page, { method: "createDomain", domain: { name, color } });
    domains.set(name, text(created, "id"));
  }
  const core = { scope: "domain", domainId: domains.get("Core") };
  for (const [path, content] of CORE_GUIDELINES) {
    await config(page, { method: "addGuideline", owner: core, path, content });
  }
  for (const path of ["guidelines/conventions.md", "guidelines/securite.md"]) {
    await config(page, { method: "addGuideline", owner: { scope: "workspace" }, path, content: "# Règles" });
  }
  return domains;
}

async function createProfiles(page: Page): Promise<void> {
  const base = { execution: "cli", subagents: [], workspace: "isolated" };
  await config(page, {
    method: "createProfile",
    profile: { ...base, name: "sonnet-review", model: "sonnet", permissionMode: "plan", maxParallel: 3 },
  });
  await config(page, {
    method: "createProfile",
    profile: { ...base, name: "haiku-tests", model: "haiku", permissionMode: "acceptEdits", maxParallel: 2 },
  });
}

export type Seeded = {
  projectId: string;
  board: string;
  tickets: Map<number, string>;
  profiles: Map<string, string>;
};

export async function seedWorkspace(page: Page, folder: string): Promise<Seeded> {
  const user = text(await rpc(page, { method: "getSession" }), "user");
  const domains = await seedConfig(page);
  await createProfiles(page);
  const created = await rpc(page, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder,
    color: "#F97316",
  });
  const projectId = text(created, "id");
  for (const [name, key, color] of [
    ["Portfolio", "POR", "#A855F7"],
    ["API Facturation", "FAC", "#22C55E"],
  ]) {
    await rpc(page, { method: "createProject", name, key, folder: null, color });
  }
  const command = (cmd: Body) => rpc(page, { method: "command", projectId, command: cmd });
  for (const path of ["guidelines/kibo.md", "guidelines/tickets.md", "guidelines/ui.md"]) {
    await config(page, {
      method: "addGuideline",
      owner: { scope: "project", projectId },
      path,
      content: "# Kibo",
    });
  }
  await command({ method: "addPage", title: "Tableau de bord", kind: "dashboard" });
  const board = text(await command({ method: "addPage", title: "Kanban", kind: "view" }), "id");
  await command({ method: "addInstance", pageId: board, component: "kanban@1.0.0" });
  const tree = text(await command({ method: "addPage", title: "Tickets", kind: "view" }), "id");
  await command({ method: "addInstance", pageId: tree, component: "tickets@1.0.0" });

  const rows = new Map(TICKETS.map((row) => [row.n, row]));
  const tickets = new Map<number, string>();
  for (let n = 1; n <= 29; n += 1) {
    const row = rows.get(n);
    const parentId = row?.parent === undefined ? null : (tickets.get(row.parent) ?? null);
    const status = row?.status === "blocked" ? "todo" : (row?.status ?? "backlog");
    const ticket = await command({
      method: "createTicket",
      title: row?.title ?? `Brouillon ${n}`,
      parentId,
      statusId: status,
    });
    tickets.set(n, text(ticket, "id"));
  }
  for (let n = 1; n <= 29; n += 1) {
    const id = tickets.get(n);
    const row = rows.get(n);
    if (!row) {
      await command({ method: "deleteTicket", ticketId: id });
      tickets.delete(n);
      continue;
    }
    const assignee = row.mine ? { kind: "human", ref: user } : undefined;
    await command({ method: "updateTicket", ticketId: id, domainId: domains.get(row.domain), assignee });
    if (row.reason)
      await command({ method: "setStatus", ticketId: id, statusId: "blocked", reason: row.reason });
  }
  for (const [from, to] of BLOCKS) {
    await command({ method: "addLink", from: tickets.get(from), to: tickets.get(to), type: "blocks" });
  }
  await command({ method: "addLink", from: tickets.get(12), to: tickets.get(16), type: "relates" });
  const profiles = new Map(
    list(await rpc(page, { method: "getConfig" }), "profiles").map((p) => [text(p, "name"), text(p, "id")]),
  );
  return { projectId, board, tickets, profiles };
}

export async function runState(page: Page, ticketKey: string): Promise<string | null> {
  const runs = list(await rpc(page, { method: "getAgents" }), "runs").filter(
    (r) => field(r, "ticketKey") === ticketKey,
  );
  const last = runs.at(-1);
  return last === undefined ? null : text(last, "state");
}

export async function assign(
  page: Page,
  seeded: Seeded,
  n: number,
  profile: string,
  state: string,
): Promise<string> {
  const run = await rpc(page, {
    method: "assignAgent",
    projectId: seeded.projectId,
    ticketId: seeded.tickets.get(n),
    profileId: seeded.profiles.get(profile),
    brief: "",
  });
  await expect.poll(() => runState(page, `KIB-${n}`), { timeout: 20_000 }).toBe(state);
  return text(run, "id");
}
