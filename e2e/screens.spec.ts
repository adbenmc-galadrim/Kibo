import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { type Browser, expect, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import { assign, rpc, type Seeded, seedWorkspace } from "./agents-seed";
import { GIT_IDENTITY } from "./git-repo";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

const SIZE = { width: 1440, height: 940 };

const PREFIX = [
  'import { z } from "zod";',
  'import type { LoroTree, TreeID } from "loro-crdt";',
  'import { AssigneeSchema } from "./assignee";',
  "",
  'export const PrioritySchema = z.enum(["low", "normal", "high"]);',
  "",
  "export const ExternalRefSchema = z.object({",
  '  kind: z.enum(["github_pr", "github_issue"]),',
  "  url: z.string().url(),",
  "  number: z.number().int(),",
  "});",
  "",
  "export const ProgressSchema = z.object({",
  "  done: z.number().int(),",
  "  total: z.number().int(),",
  "});",
  "",
  "export const LinkSchema = z.object({",
  "  from: z.string(),",
  "  to: z.string(),",
  '  type: z.enum(["blocks", "relates"]),',
  "});",
  "",
  "export type Priority = z.infer<typeof PrioritySchema>;",
  "export type ExternalRef = z.infer<typeof ExternalRefSchema>;",
  "export type Progress = z.infer<typeof ProgressSchema>;",
  "export type Link = z.infer<typeof LinkSchema>;",
  "",
  "export const TITLE_MAX = 200;",
  "export const DESCRIPTION_MAX = 20_000;",
  "",
  "export const WaitingSchema = z.object({",
  "  keys: z.array(z.string()),",
  "  since: z.string().datetime(),",
  "});",
  "",
  "export type Waiting = z.infer<typeof WaitingSchema>;",
];

const TICKET_BEFORE = [
  ...PREFIX,
  "export const TicketSchema = z.object({",
  "  id: z.string(),",
  "  parentId: z.string().nullable(),",
  "  statusId: z.string(),",
  "  domainId: z.string().optional(),",
  "  assignee: AssigneeSchema.optional(),",
  "});",
  "",
  "export type Ticket = z.infer<typeof TicketSchema>;",
  "",
  "export function toIndexRow(t: Ticket) {",
  "  return { id: t.id, parent: t.parentId };",
  "}",
  "",
];

const TICKET_AFTER = [
  ...PREFIX,
  "export const TicketSchema = z.object({",
  "  id: z.string(),",
  "  key: z.string().regex(/^[A-Z]+-\\d+(\\.\\d+)*$/),",
  "  statusId: z.string(),",
  "  domainId: z.string().optional(),",
  "  assignee: AssigneeSchema.optional(),",
  "});",
  "",
  "export type Ticket = z.infer<typeof TicketSchema>;",
  "",
  "export function moveTicket(tree: LoroTree, id: TreeID, parent: TreeID) {",
  "  tree.move(id, parent);",
  "}",
  "",
  "export function toIndexRow(t: Ticket) {",
  "  return { id: t.id, key: t.key, status: t.statusId };",
  "}",
  "",
];

const lines = (count: number, make: (i: number) => string) =>
  `${Array.from({ length: count }, (_, i) => make(i + 1)).join("\n")}\n`;

type MockupRepo = { repo: string; worktree: string; remove(): void };

function createMockupRepo(): MockupRepo {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "kibo-e2e-screens-")));
  const repo = join(dir, "repo");
  const remote = join(dir, "remote.git");
  const worktree = join(repo, ".kibo", "worktrees", "kib-12");
  mkdirSync(repo);
  const env = { ...process.env, ...GIT_IDENTITY };
  const gitIn =
    (cwd: string) =>
    (...args: string[]) =>
      execFileSync("git", args, { cwd, env, encoding: "utf8" });
  const writeIn = (root: string) => (path: string, content: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  };
  const git = gitIn(repo);
  const write = writeIn(repo);
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", remote], { env });
  git("init", "-q", "-b", "main");
  git("config", "commit.gpgsign", "false");
  git("remote", "add", "origin", remote);
  appendFileSync(join(repo, ".git", "info", "exclude"), ".kibo/\n");
  write("package.json", '{ "name": "kibo", "workspaces": ["packages/*"] }\n');
  write("packages/core/ticket.ts", `${TICKET_BEFORE.join("\n")}`);
  write("packages/core/index.ts", 'export * from "./ticket";\nexport * from "./legacy-tree";\n');
  write(
    "packages/core/legacy-tree.ts",
    lines(56, (i) => `export const legacy${i} = ${i};`),
  );
  git("add", "-A");
  git("commit", "-q", "-m", "chore: monorepo Bun workspaces");
  git("push", "-q", "-u", "origin", "main");
  git("worktree", "add", "-q", "-b", "kib-12", worktree, "main");
  const wt = gitIn(worktree);
  const wWrite = writeIn(worktree);
  wWrite("packages/core/move.ts", "export const reparent = (id: string, parent: string) => [id, parent];\n");
  wt("add", "-A");
  wt("commit", "-q", "-m", "feat(core): opérations move / reparent");
  wWrite("packages/core/convergence.test.ts", 'import { test } from "bun:test";\ntest.todo("fast-check");\n');
  wt("add", "-A");
  wt("commit", "-q", "-m", "test(core): convergence fast-check");
  wWrite("packages/core/ticket.ts", TICKET_AFTER.join("\n"));
  wWrite(
    "packages/core/tree.ts",
    lines(120, (i) => `export const node${i} = "n${i}";`),
  );
  wt("add", "packages/core/ticket.ts", "packages/core/tree.ts");
  wWrite(
    "packages/core/index.ts",
    'export * from "./ticket";\nexport * from "./tree";\nexport * from "./move";\nexport * from "./sqlite";\n',
  );
  rmSync(join(worktree, "packages/core/legacy-tree.ts"));
  return { repo, worktree, remove: () => rmSync(dir, { recursive: true, force: true }) };
}

let page: Page;
let mockup: MockupRepo;
let seeded: Seeded;

const theme = (info: TestInfo) => (info.project.name.endsWith("light") ? "light" : "dark");

async function capture(info: TestInfo, screen: string) {
  const path = join(info.project.outputDir, "screens", `${screen}-${theme(info)}.png`);
  await page.screenshot({ path, animations: "disabled" });
}

async function openPage(browser: Browser, info: TestInfo): Promise<Page> {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: SIZE });
  return context.newPage();
}

test.beforeAll(async ({ browser }, info) => {
  page = await openPage(browser, info);
  mockup = createMockupRepo();
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  await rpc(page, {
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "opus-dev",
        model: "opus",
        permissionMode: "acceptEdits",
        maxParallel: 2,
        execution: "cli",
        subagents: [],
        workspace: "worktree",
      },
    },
  });
  seeded = await seedWorkspace(page, mockup.repo);
  await rpc(page, {
    method: "command",
    projectId: seeded.projectId,
    command: {
      method: "updateTicket",
      ticketId: seeded.tickets.get(12),
      description: "Arbre des tickets sur LoroTree : voir packages/core/ticket.ts:43 pour le schéma.",
    },
  });
  await assign(page, seeded, 12, "opus-dev", "running");
  await assign(page, seeded, 14, "opus-dev", "waiting_input");
});

test.afterAll(async () => {
  await page.context().close();
  await expect(() => mockup.remove()).toPass();
});

const bar = () => page.getByRole("tablist", { name: "Onglets" });
const sideButton = (name: string | RegExp) =>
  page.getByRole("button", { name, exact: typeof name === "string" }).first();

test("18 · palette ouverte sur kib-1", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await expect(page.getByRole("region", { name: "En cours" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("kib-1");
  await expect(palette.getByRole("option", { name: /KIB-12 · Schéma Loro/ })).toBeVisible();
  await capture(info, "18");
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("20 · menu contextuel d'un onglet", async () => {
  const info = test.info();
  const kanban = bar().getByRole("tab", { name: "Kibo · Kanban" });
  await expect(kanban).toHaveAttribute("aria-selected", "true");
  await kanban.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await sideButton("Tickets").click({ modifiers: ["ControlOrMeta"] });
  const tickets = bar().getByRole("tab", { name: "Kibo · Tickets" });
  await tickets.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await sideButton("Tableau de bord").click({ modifiers: ["ControlOrMeta"] });
  await page.getByRole("button", { name: "Nouvel onglet" }).click();
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("KIB-12");
  await palette.getByRole("option", { name: /KIB-12 · Schéma Loro/ }).click();
  await sideButton(/^Changements/).click({ modifiers: ["ControlOrMeta"] });
  await bar().getByRole("tab", { name: "Kibo · KIB-12" }).click();
  await page.getByRole("button", { name: "packages/core/ticket.ts:43" }).click();
  await page.getByRole("button", { name: "Ouvrir dans un onglet" }).click();
  await expect(bar().getByRole("tab", { name: "ticket.ts" })).toBeVisible();
  const dashboard = bar().getByRole("tab", { name: "Kibo · Tableau de bord" });
  await dashboard.click();
  await dashboard.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: /Fermer les onglets à droite/ })).toBeVisible();
  await capture(info, "20");
  await page.keyboard.press("Escape");
});

test("21 · Changements, fichier indexé sélectionné", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/changes?wt=${encodeURIComponent(mockup.worktree)}`);
  const staged = page.getByRole("group", { name: "Indexés", exact: true });
  await staged.getByRole("button", { name: /ticket\.ts/ }).click();
  await expect(page.getByRole("button", { name: "Indexer le bloc" }).first()).toBeVisible();
  await expect(page.getByText("↑2").first()).toBeVisible();
  await expect(page.getByLabel("Message")).not.toHaveValue("");
  await expect(page.getByText("opus-dev-1 travaille dans ce worktree.", { exact: false })).toBeVisible();
  await capture(info, "21");
});

test("22 · dialogue PR avec fichiers indexés non commités", async () => {
  const info = test.info();
  await page.getByRole("button", { name: "Pousser et créer la PR" }).click();
  const dialog = page.getByRole("dialog", { name: "Pousser et créer la PR" });
  await expect(dialog.getByRole("button", { name: "Commiter d'abord" })).toBeVisible();
  await expect(dialog.getByLabel("Titre")).not.toHaveValue("");
  await expect(dialog.getByText("kib-12 → main · 2 commits non poussés · 2 fichiers")).toBeVisible();
  await capture(info, "22");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
});

test("23 · aperçu de ticket.ts ouvert depuis un ticket", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("KIB-12");
  await expect(palette.getByRole("option", { name: /KIB-12 · Schéma Loro/ })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Enter");
  const sheet = page.getByRole("dialog").filter({ hasText: "Schéma Loro des tickets" });
  await sheet.getByRole("button", { name: "packages/core/ticket.ts:43" }).click();
  const preview = page.getByRole("dialog").filter({ hasText: "Ouvrir dans un onglet" });
  await expect(preview.getByText("Ligne 43, col 3")).toBeVisible();
  await capture(info, "23");
});

test("densité 13 px des maquettes", async () => {
  const info = test.info();
  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await page.reload();
  const doing = page.getByRole("region", { name: "En cours" });
  await expect(doing).toBeVisible();
  const size = (l: Locator) => l.evaluate((el) => getComputedStyle(el).fontSize);
  expect(await size(page.locator("body"))).toBe("13px");
  expect(await size(sideButton("Vue d'ensemble"))).toBe("13px");
  expect(await size(page.getByText("Projets", { exact: true }).first())).toBe("10px");
  expect(await size(doing.getByText("KIB-12", { exact: true }))).toBe("11px");
  expect(await size(bar().getByRole("tab", { name: "Kibo · Kanban" }))).toBe("12px");
  await capture(info, "densite-kanban");
});
