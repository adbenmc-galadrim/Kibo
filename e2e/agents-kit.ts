import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { homeOf } from "./e2e-home";

const KIBO_DEV = fileURLToPath(new URL("../.claude/agents/kibo-dev.md", import.meta.url));
const PLUGIN = ["plugins", "cache", "official", "superpowers", "6.4.1"];

export const agentMd = (name: string, description: string, body = `Tu es ${name}.`) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

export const skillMd = (name: string, description: string, body: string) =>
  `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}\n`;

export const BRAINSTORMING_BODY = [
  "# Brainstorming",
  "",
  "Avant de coder, liste les cas limites et les questions ouvertes.",
  "",
  "- Une idée par ligne.",
  "- Les exemples vivent dans exemples.md.",
].join("\n");

function put(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}

export type AgentFiles = { claude: string; kiboDev: string };

function seedClaudeHome(claude: string): void {
  put(
    join(claude, "agents", "review-pr.md"),
    agentMd("review-pr", "Relit une PR en lecture seule et rend un verdict accepté ou refusé"),
  );
  const skill = join(claude, "skills", "brainstorming");
  put(
    join(skill, "SKILL.md"),
    skillMd("brainstorming", "Explore une idée avant de coder", BRAINSTORMING_BODY),
  );
  put(
    join(skill, "exemples.md"),
    "# Exemples\n\n- Formulaire de connexion : e-mail vide, mot de passe trop court.\n",
  );
  const plugin = join(claude, ...PLUGIN);
  put(
    join(plugin, "skills", "brainstorming", "SKILL.md"),
    skillMd(
      "brainstorming",
      "Explore l'intention, les besoins et la conception avant tout travail créatif",
      "# Brainstorming du plugin",
    ),
  );
  const index = {
    version: 2,
    plugins: { "superpowers@official": [{ scope: "user", installPath: plugin, version: "6.4.1" }] },
  };
  put(join(claude, "plugins", "installed_plugins.json"), JSON.stringify(index));
}

function seedProjectFolder(folder: string): string {
  const agents = join(folder, ".claude", "agents");
  const kiboDev = join(agents, "kibo-dev.md");
  put(kiboDev, readFileSync(KIBO_DEV, "utf8"));
  put(join(agents, "livraison.md"), agentMd("livraison", "Livre un ticket en TDD avec des commits propres"));
  put(join(agents, "review.md"), agentMd("review", "Relit un diff et rend un verdict accepté ou refusé"));
  put(
    join(folder, ".claude", "skills", "brainstorming", "SKILL.md"),
    skillMd("brainstorming", "Explore une idée du projet Kibo", "# Brainstorming du projet"),
  );
  return kiboDev;
}

export function seedAgentFiles(info: TestInfo, projectFolder: string): AgentFiles {
  const claude = join(homeOf(info), "claude");
  seedClaudeHome(claude);
  return { claude, kiboDev: seedProjectFolder(projectFolder) };
}

type Shot = (page: Page, info: TestInfo, name: string) => Promise<void>;

const folders = (page: Page) => page.getByRole("tree", { name: "Dossiers" });
const folder = (page: Page, name: string) => folders(page).getByRole("treeitem", { name, exact: true });
const panelFiles = (page: Page, title: string) => page.getByRole("list", { name: title, exact: true });

export async function seedWorkspaceDomain(page: Page): Promise<void> {
  const created = await rpc(page, {
    method: "config",
    command: { method: "createDomain", domain: { name: "Sécurité", color: "#B45309" } },
  });
  const domainId = text(created, "id");
  await rpc(page, {
    method: "config",
    command: {
      method: "addGuideline",
      owner: { scope: "domain", domainId, projectId: null },
      path: "guidelines/securite-workspace.md",
      content: "# Sécurité\n\n- Démon sur 127.0.0.1 uniquement.",
    },
  });
}

async function projectFolders(page: Page, info: TestInfo, shot: Shot): Promise<void> {
  await expect(folder(page, "Workspace")).toHaveAttribute("aria-expanded", "true");
  for (const name of ["Kibo", "Portfolio", "API Facturation"])
    await expect(folder(page, name)).toHaveAttribute("aria-level", "1");
  await folder(page, "Kibo").click();
  await expect(folder(page, "Kibo")).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("heading", { name: "Projet · Kibo" })).toBeVisible();
  const kibo = panelFiles(page, "Projet · Kibo");
  await expect(kibo.getByRole("button", { name: "guidelines/kibo.md" })).toBeVisible();
  await expect(kibo.getByRole("button", { name: "guidelines/conventions.md" })).toHaveCount(0);
  await shot(page, info, "207");
  await folder(page, "Core").click();
  await expect(panelFiles(page, "Domaine · Core").getByText("skills/loro-patterns.md")).toBeVisible();
  await expect(page.getByText("domaine de Kibo")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Éditer" })).toHaveAttribute("aria-selected", "true");
  await shot(page, info, "ecran-14");
  await shot(page, info, "208");
}

async function emptyProject(page: Page, info: TestInfo, shot: Shot): Promise<void> {
  await folder(page, "Portfolio").click();
  await expect(page.getByText("Aucune guideline pour ce projet.")).toBeVisible();
  await expect(folder(page, "Aucun fichier")).toBeVisible();
  await shot(page, info, "207b");
  await page.getByRole("button", { name: "Nouveau domaine", exact: true }).click();
  await folders(page).getByLabel("Nom du domaine").fill("Livraison");
  await folders(page).getByLabel("Nom du domaine").press("Enter");
  await expect(folder(page, "Livraison")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Domaine · Livraison" })).toBeVisible();
  await expect(page.getByText("domaine de Portfolio")).toBeVisible();
}

async function workspaceDomain(page: Page, info: TestInfo, shot: Shot): Promise<void> {
  const help = page.getByRole("button", { name: "Comment les agents sont configurés" });
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "false");
  await folder(page, "Sécurité").first().click();
  await expect(page.getByText("domaine du workspace")).toBeVisible();
  await expect(page.getByText("S'applique à tout projet local.")).toBeVisible();
  await shot(page, info, "208b");
  await help.click();
  await expect(help).toHaveAttribute("aria-expanded", "true");
}

async function keyboardWalk(page: Page): Promise<void> {
  await folder(page, "Workspace").click();
  await folder(page, "Workspace").focus();
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("ArrowDown");
  await expect(folder(page, "Sécurité").first()).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Domaine · Sécurité" })).toBeVisible();
}

export async function guidelineFolders(page: Page, info: TestInfo, shot: Shot): Promise<void> {
  await projectFolders(page, info, shot);
  await emptyProject(page, info, shot);
  await workspaceDomain(page, info, shot);
  await keyboardWalk(page);
}

export async function guidelinesFromTicketAndProject(
  page: Page,
  info: TestInfo,
  shot: Shot,
  ticket: { projectId: string; ticketId: string },
): Promise<void> {
  await page.goto(`/#/p/${ticket.projectId}/t/${encodeURIComponent(ticket.ticketId)}`);
  const picker = page.getByRole("combobox", { name: "Domaine" });
  await picker.click();
  const list = page.getByRole("listbox");
  await expect(list.getByText("Domaines de Kibo")).toBeVisible();
  await expect(list.getByText("Domaines du workspace")).toBeVisible();
  await list.evaluate((el) =>
    Promise.all(el.ownerDocument.getAnimations().map((a) => a.finished.catch(() => null))),
  );
  await shot(page, info, "209");
  await page.keyboard.press("Escape");
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Kibo", exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  const open = edit.getByRole("button", { name: "Ouvrir le dossier de guidelines →" });
  await open.scrollIntoViewIfNeeded();
  await expect(edit.getByText(/\d+ fichiers \.md · \d+ domaines/)).toBeVisible();
  await shot(page, info, "209b");
  await open.click();
  await expect(edit).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`#/settings/domains\\?project=${ticket.projectId}$`));
  await expect(folder(page, "Kibo")).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("heading", { name: "Projet · Kibo" })).toBeVisible();
}
