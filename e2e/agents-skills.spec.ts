import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { type AgentFiles, seedAgentFiles } from "./agents-kit";
import { createGitRepo, list, pairBrowser, rpc, runState, text } from "./agents-seed";
import { WIDE } from "./visibility-kit";

test.describe.configure({ mode: "serial" });
test.setTimeout(120_000);

type Kit = { page: Page; projectId: string; tickets: Map<string, string>; files: AgentFiles; repo: string };

let kit: Kit;

const theme = (info: TestInfo) => (info.project.name.endsWith("light") ? "light" : "dark");

async function capture(info: TestInfo, screen: string) {
  const path = info.outputPath(`ecran-${screen}-${theme(info)}.png`);
  await kit.page.screenshot({ path, animations: "disabled" });
}

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function seed(page: Page, info: TestInfo): Promise<Kit> {
  const repo = createGitRepo();
  const files = seedAgentFiles(info, repo);
  await pairBrowser(page);
  const project = await rpc(page, {
    method: "createProject",
    name: "Kibo",
    key: "KIB",
    folder: repo,
    color: "#F97316",
  });
  const projectId = text(project, "id");
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const board = text(await command({ method: "addPage", title: "Kanban", kind: "view" }), "id");
  await command({ method: "addInstance", pageId: board, component: "kanban@1.0.0" });
  const tickets = new Map<string, string>();
  for (let n = 1; n <= 16; n += 1) {
    const ticket = await command({ method: "createTicket", title: `Ticket ${n}`, statusId: "todo" });
    tickets.set(`KIB-${n}`, text(ticket, "id"));
  }
  await rpc(page, { method: "agents.list", projectId });
  return { page, projectId, tickets, files, repo };
}

const ref = (name: string) => `project:${kit.projectId}:${name}`;

async function assignTo(key: string, agent: string): Promise<string> {
  const run = await rpc(kit.page, {
    method: "assignAgent",
    projectId: kit.projectId,
    ticketId: kit.tickets.get(key),
    profileId: agent,
    brief: "",
  });
  await expect.poll(() => runState(kit.page, key), { timeout: 45_000 }).toBe("done");
  return text(run, "id");
}

test.beforeAll(async ({ browser }, info) => {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: WIDE });
  kit = await seed(await context.newPage(), info);
});

test.afterAll(async () => {
  await kit?.page.context().close();
  const dir = kit?.repo;
  if (dir) await expect(() => rmSync(dir, { recursive: true, force: true })).toPass();
});

const agentsPage = async () => {
  await kit.page.goto("/#/agents");
  await expect(kit.page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
};

test("192 · la page Agents montre les agents découverts et un chef d'orchestre", async () => {
  const info = test.info();
  const { page } = kit;
  await agentsPage();
  await expect(page.getByRole("article", { name: "kibo-dev" }).getByText("Projet · Kibo")).toBeVisible();
  await expect(page.getByRole("article", { name: "review-pr" }).getByText("Global")).toBeVisible();
  await expect(page.getByRole("article", { name: "livraison" })).toBeVisible();
  const system = page.getByRole("button", { name: /^Agents de Kibo/ });
  await expect(system).toHaveAttribute("aria-expanded", "false");
  await system.click();
  await expect(page.getByRole("region", { name: "Agents de Kibo" })).toBeVisible();
  await capture(info, "192");
  await system.click();

  await page.getByRole("button", { name: "Nouvel agent" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvel agent" });
  await dialog.getByText("Chef d'orchestre", { exact: true }).click();
  await dialog.getByLabel("Nom", { exact: true }).fill("chef");
  await dialog.getByRole("radio", { name: "Projet" }).click();
  await dialog.getByLabel("Description").fill("Enchaîne livraison, review puis seo et rend un compte rendu");
  await dialog.getByRole("button", { name: "Créer l'agent" }).click();
  await expect(dialog.getByText("Sous-agent manquant : seo")).toBeVisible();
  await capture(info, "192b");
  await dialog.getByRole("button", { name: "Fermer" }).first().click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("article", { name: "chef" })).toBeVisible();
  const chef = list(await rpc(page, { method: "agents.list", projectId: kit.projectId }), "agents").find(
    (a) => field(a, "name") === "chef",
  );
  expect(field(field(chef, "settings"), "subagents")).toEqual([ref("livraison"), ref("review")]);
});

test("193 · la fiche de kibo-dev : spec, réglages, sous-agents, skills, aperçu", async () => {
  const info = test.info();
  const { page } = kit;
  await agentsPage();
  await page.getByRole("button", { name: "Ouvrir l'agent kibo-dev" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "kibo-dev" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Spec" })).toBeVisible();
  const settings = page.getByRole("button", { name: /^Réglages techniques/ });
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  await capture(info, "193");
  await settings.click();
  await expect(page.getByText("Runs en parallèle", { exact: true })).toBeVisible();
  await capture(info, "193b");
  await settings.click();

  await page.getByRole("button", { name: /^Sous-agents appelables/ }).click();
  const subagents = page.getByRole("group", { name: "Sous-agents appelables" });
  await subagents.getByRole("checkbox", { name: "review", exact: true }).click();
  await expect(subagents.getByRole("checkbox", { name: "review", exact: true })).toBeChecked();
  await page.getByRole("button", { name: /^Skills autorisés/ }).click();
  await page.getByRole("radio", { name: "Liste" }).click();
  const skills = page.getByRole("group", { name: "Skills autorisés" });
  await skills.getByRole("checkbox", { name: "brainstorming", exact: true }).click();
  await skills.getByRole("checkbox", { name: "superpowers:brainstorming", exact: true }).click();
  await expect
    .poll(async () =>
      field(field(await rpc(page, { method: "agents.read", ref: ref("kibo-dev") }), "settings"), "skills"),
    )
    .toEqual({ mode: "list", ids: ["brainstorming", "superpowers:brainstorming"] });
  await capture(info, "193c");

  await page.getByRole("button", { name: "Ce que reçoit l'agent" }).click();
  const preview = page.getByRole("dialog", { name: /Ce que reçoit l'agent/ });
  await expect(preview.getByText("agents.json")).toBeVisible();
  await capture(info, "193d");
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
});

test("193e · un fichier modifié sur le disque n'est jamais écrasé sans accord", async () => {
  const info = test.info();
  const { page } = kit;
  const description = page.getByLabel("Description");
  await expect(description).toBeVisible();
  const disk = readFileSync(kit.files.kiboDev, "utf8");
  writeFileSync(kit.files.kiboDev, disk.replace("Tu implémentes", "Tu implémentes, sans exception,"));
  await expect(page.getByText("Modifié sur le disque")).toBeVisible({ timeout: 15_000 });
  await description.fill("Implémente une tâche du plan en TDD, puis fait relire par review");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  const conflict = page.getByRole("dialog", { name: "Le fichier a changé sur le disque" });
  await expect(conflict).toBeVisible();
  await capture(info, "193e");
  await conflict.getByRole("button", { name: "Écraser avec ma version" }).click();
  await expect(conflict).toBeHidden();
  await expect
    .poll(() => readFileSync(kit.files.kiboDev, "utf8"))
    .toContain("description: Implémente une tâche du plan en TDD, puis fait relire par review");
});

let reviewedRun = "";

test("196 · un run qui utilise des skills laisse une review, visible au fil et dans Activité", async () => {
  const info = test.info();
  const { page } = kit;
  reviewedRun = await assignTo("KIB-14", ref("kibo-dev"));
  await page.goto(`/#/runs/${reviewedRun}`);
  const feed = page.getByRole("region", { name: "Fil narratif" });
  await feed.getByRole("button", { name: "A lu 1 fichier et utilisé 1 skill" }).click();
  await expect(feed.getByText("A utilisé le skill brainstorming")).toBeVisible();
  await expect(feed.getByText("Kibo a rappelé la review des skills")).toBeVisible();
  await expect(feed.getByRole("button", { name: /^A laissé une review/ })).toBeVisible();
  const reviews = page.getByRole("region", { name: "Reviews de skills" });
  await expect(reviews.getByText("Manque un exemple.", { exact: false })).toBeVisible();
  await capture(info, "196");

  await page.goto(`/#/p/${kit.projectId}/t/${kit.tickets.get("KIB-14")}`);
  await page.getByRole("tab", { name: "Activité" }).click();
  await expect(page.getByRole("region", { name: "Reviews de skills" }).first()).toBeVisible();
});

async function openNotes() {
  const button = kit.page.getByRole("button", { name: /^Notes de review/ });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(kit.page.getByRole("complementary", { name: "Notes de review" })).toBeVisible();
}

const skillsPage = async () => {
  await kit.page.goto("/#/agents/skills");
  await expect(kit.page.getByRole("heading", { level: 1, name: "Skills" })).toBeVisible();
  const back = kit.page.getByRole("navigation", { name: "Fil d'Ariane du skill" }).getByRole("button");
  if ((await back.count()) > 0) await back.click();
};

test("194 · la page Skills : trois sources, plugin en lecture seule, copie", async () => {
  const info = test.info();
  const { page } = kit;
  await skillsPage();
  const computer = page.getByRole("region", { name: "Cet ordinateur" });
  await expect(computer.getByRole("button", { name: "Ouvrir le skill brainstorming" })).toContainText(
    "1 note",
  );
  const project = page.getByRole("region", { name: "Projet · Kibo" });
  await expect(project.getByText("masqué", { exact: true })).toBeVisible();
  const plugin = page.getByRole("region", { name: /^superpowers/ });
  await expect(plugin.getByText("lecture seule", { exact: true })).toBeVisible();
  await capture(info, "194");

  await plugin.getByRole("button", { name: "Ouvrir le skill superpowers:brainstorming" }).click();
  await page.getByRole("button", { name: "Copier pour modifier" }).first().click();
  const copy = page.getByRole("dialog", { name: "Copier pour modifier" });
  await expect(copy.getByLabel("Nom de la copie")).toBeVisible();
  await capture(info, "194b");
  await copy.getByRole("button", { name: "Annuler" }).click();
  await expect(copy).toBeHidden();

  await openNotes();
  const notes = page.getByRole("complementary", { name: "Notes de review" });
  await notes.getByRole("button", { name: "Ignorer" }).click();
  await notes.getByRole("button", { name: /^Traitées/ }).click();
  await expect(notes.getByText("Ignorée", { exact: true })).toBeVisible();
});

test("195 · l'éditeur de skill : aperçu, fichiers, intégration d'une review, historique", async () => {
  const info = test.info();
  const { page } = kit;
  await skillsPage();
  await page
    .getByRole("region", { name: "Cet ordinateur" })
    .getByRole("button", { name: "Ouvrir le skill brainstorming" })
    .click();
  await expect(page.getByRole("heading", { level: 2, name: "brainstorming" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Fichiers" }).getByText("exemples.md")).toBeVisible();
  await page.getByRole("radio", { name: "Côte à côte" }).first().click();
  await capture(info, "195");

  await openNotes();
  const notes = page.getByRole("complementary", { name: "Notes de review" });
  await expect(notes.getByText("Ajouter une section Exemple.", { exact: false })).toBeVisible();
  await capture(info, "195b");
  await notes.getByRole("button", { name: "Intégrer" }).click();
  const diff = page.getByRole("region", { name: /^Intégrer la review de / });
  await expect(diff).toBeVisible();
  await capture(info, "195c");
  await diff.getByRole("button", { name: "Enregistrer" }).click();
  await expect(diff).toBeHidden();
  const skillFile = `${kit.files.claude}/skills/brainstorming/SKILL.md`;
  await expect.poll(() => readFileSync(skillFile, "utf8")).toContain("## Exemple");

  await openNotes();
  const after = page.getByRole("complementary", { name: "Notes de review" });
  await after.getByRole("button", { name: /^Traitées/ }).click();
  await expect(after.getByText("Intégrée", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Historique", exact: true }).click();
  const history = page.getByRole("dialog", { name: "Historique" });
  const versions = history.getByRole("list", { name: "Versions" }).getByRole("button");
  await expect(versions).toHaveCount(2);
  await expect(versions.first()).toContainText("Intégration");
  await versions.last().click();
  await history.getByRole("button", { name: "Restaurer cette version" }).click();
  await expect(history).toBeHidden();
  await expect.poll(() => readFileSync(skillFile, "utf8")).not.toContain("## Exemple");
  await expect(page.getByText("Les exemples vivent dans exemples.md.").first()).toBeVisible();
  await capture(info, "195d");
});

test("le garde refuse un skill et un sous-agent hors liste, le fil le montre", async () => {
  const { page } = kit;
  const runId = await assignTo("KIB-15", ref("kibo-dev"));
  await page.goto(`/#/runs/${runId}`);
  const feed = page.getByRole("region", { name: "Fil narratif" });
  await feed.getByRole("button", { name: /^A lancé 2 sous-agents/ }).click();
  await expect(feed.getByText("Kibo a refusé le skill")).toBeVisible();
  await expect(feed.getByText("deploy", { exact: true })).toBeVisible();
  await expect(feed.getByText("Kibo a refusé le sous-agent")).toBeVisible();
  await expect(feed.getByText("seo", { exact: true })).toBeVisible();
});
