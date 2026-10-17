import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { type AgentFiles, seedAgentFiles, skillMd } from "./agents-kit";
import { createGitRepo, list, pairBrowser, rpc, runState, showAgentExecution, text } from "./agents-seed";
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
  await showAgentExecution(page);
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
  const allSubagents = subagents.getByRole("switch", { name: "Tous les sous-agents" });
  const allowsAll = async () =>
    field(
      field(await rpc(page, { method: "agents.read", ref: ref("kibo-dev") }), "settings"),
      "allSubagents",
    );
  await allSubagents.click();
  await expect.poll(allowsAll).toBe(true);
  await expect(subagents.getByRole("checkbox", { name: "review", exact: true })).toBeDisabled();
  await capture(info, "193c-tous");
  await allSubagents.click();
  await expect.poll(allowsAll).toBe(false);
  await expect(subagents.getByRole("checkbox", { name: "review", exact: true })).toBeEnabled();
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
  await expect(feed.getByRole("button", { name: "A utilisé le skill brainstorming" })).toBeVisible();
  await expect(
    feed.getByRole("button", { name: "A utilisé le skill superpowers:brainstorming" }),
  ).toBeVisible();
  await expect(feed.getByText("Kibo a rappelé la review des skills")).toBeVisible();
  await expect(feed.getByRole("button", { name: "A laissé une review de 2 skills" })).toBeVisible();
  const reviews = page.getByRole("region", { name: "Reviews de skills" });
  await expect(reviews.getByText("Manque un exemple.", { exact: false })).toBeVisible();
  await capture(info, "196");

  await page.goto(`/#/p/${kit.projectId}/t/${kit.tickets.get("KIB-14")}`);
  await page.getByRole("tab", { name: "Activité" }).click();
  await expect(page.getByRole("region", { name: "Reviews de skills" }).first()).toBeVisible();
});

test("/ dans la réponse à un run propose les skills les plus utilisés, filtrés et insérés au clavier", async () => {
  const info = test.info();
  const { page } = kit;
  await page.goto(`/#/runs/${reviewedRun}`);
  const box = page.getByRole("combobox", { name: /^Écrire à / });
  await box.click();
  await box.pressSequentially("/");
  const list = page.getByRole("listbox", { name: "Skills" });
  const options = list.getByRole("option");
  await expect(options).toHaveCount(2);
  await expect(options.filter({ hasText: /^\/brainstormingCet ordinateur.*1 run\/30 j$/ })).toHaveCount(1);
  await expect(
    options.filter({ hasText: /^\/superpowers:brainstormingPlugin · superpowers.*1 run\/30 j$/ }),
  ).toHaveCount(1);
  await expect(box).toHaveAttribute("aria-expanded", "true");
  await expect(options.first()).toHaveAttribute("aria-selected", "true");
  await box.press("ArrowDown");
  await expect(options.nth(1)).toHaveAttribute("aria-selected", "true");
  await capture(info, "skill-complete-run");
  await box.pressSequentially("sup");
  await expect(options).toHaveText([/^\/superpowers:brainstorming/]);
  await box.press("Enter");
  await expect(box).toHaveValue("/superpowers:brainstorming ");
  await expect(list).toBeHidden();

  await page.goto(`/#/p/${kit.projectId}`);
  await page.getByRole("button", { name: "Agent de projet", exact: true }).click();
  const chat = page.getByRole("combobox", { name: "Message à l'agent de projet" });
  await chat.click();
  await chat.pressSequentially("/");
  const projectOptions = page.getByRole("listbox", { name: "Skills" }).getByRole("option");
  await expect(projectOptions).toHaveCount(2);
  await expect(
    projectOptions.filter({ hasText: /^\/brainstormingCet ordinateur.*1 run\/30 j$/ }),
  ).toHaveCount(1);
  await capture(info, "skill-complete-project-agent");
  await chat.press("Escape");
  await expect(page.getByRole("listbox", { name: "Skills" })).toBeHidden();
  await expect(chat).toBeVisible();
});

async function openNotes() {
  const button = kit.page.getByRole("button", { name: /^Notes de review/ });
  if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
  await expect(kit.page.getByRole("complementary", { name: "Notes de review" })).toBeVisible();
}

const skillsPage = async () => {
  await kit.page.goto("/#/agents/skills");
  await expect(kit.page.getByRole("heading", { level: 1, name: "Skills" })).toBeVisible();
  await kit.page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Skills", exact: true })
    .click();
  await expect(kit.page.getByRole("navigation", { name: "Fil d'Ariane du skill" })).toHaveCount(0);
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
  const pluginHeader = plugin.getByRole("button", { name: /^superpowers/ });
  await expect(pluginHeader).toHaveAttribute("aria-expanded", "false");
  await expect(plugin.getByRole("button", { name: /^Ouvrir le skill/ })).toHaveCount(0);
  await capture(info, "194");

  await page.getByRole("radio", { name: /^Avec notes · / }).click();
  const rows = page.getByRole("button", { name: /^Ouvrir le skill/ });
  await expect(computer.getByRole("button", { name: "Ouvrir le skill brainstorming" })).toBeVisible();
  await expect(rows.filter({ hasNotText: /\d+ notes?/ })).toHaveCount(0);
  await capture(info, "194-notes");
  await page.getByRole("radio", { name: /^Tous · / }).click();

  await pluginHeader.click();
  await expect(plugin.getByText("lecture seule", { exact: true })).toBeVisible();

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
  const refusedSkill = feed.getByRole("button", { name: "Kibo a refusé le skill deploy" });
  await expect(refusedSkill).toBeVisible();
  await expect(refusedSkill).toHaveClass(/text-destructive/);
  await expect(feed.getByRole("button", { name: "Kibo a refusé le sous-agent seo" })).toBeVisible();
  await expect(feed.getByText("Kibo a rappelé la review des skills")).toHaveCount(0);
});

const MANY_FILES = [
  ...Array.from({ length: 24 }, (_, i) => `reference/fichier-${String(i).padStart(2, "0")}.md`),
  "scripts/lib/plan/plan-data-js-avec-un-nom-vraiment-tres-long.mjs",
];

const inside = (inner: Box, outer: Box) =>
  inner.x >= outer.x && inner.x + inner.width <= outer.x + outer.width;
type Box = { x: number; y: number; width: number; height: number };

test("2026-10-14 · un skill à beaucoup de fichiers : la colonne défile seule, sans taille ni débordement", async () => {
  const info = test.info();
  const { page } = kit;
  const dir = `${kit.files.claude}/skills/full-delivery`;
  mkdirSync(`${dir}/reference`, { recursive: true });
  mkdirSync(`${dir}/scripts/lib/plan`, { recursive: true });
  writeFileSync(`${dir}/SKILL.md`, skillMd("full-delivery", "Livre une PR de bout en bout", "# Livraison"));
  for (const file of MANY_FILES) writeFileSync(`${dir}/${file}`, `# ${file}\n\n${"Ligne.\n".repeat(300)}`);
  writeFileSync(`${dir}/scripts/install`, Buffer.from([0, 1, 2, 3, 255]));
  try {
    await skillsPage();
    await page
      .getByRole("region", { name: "Cet ordinateur" })
      .getByRole("button", { name: "Ouvrir le skill full-delivery" })
      .click();
    const column = page.getByRole("region", { name: "Fichiers" });
    await expect(column.getByText(MANY_FILES.at(-1) ?? "")).toBeVisible();
    await expect(column.getByText(/\d\s?(Ko|o)$/)).toHaveCount(0);
    const sizes = await column.evaluate((el) => ({
      overflowX: el.scrollWidth - el.clientWidth,
      scrolls: el.scrollHeight > el.clientHeight,
    }));
    expect(sizes).toEqual({ overflowX: 0, scrolls: true });
    const box = await column.boundingBox();
    if (!box) throw new Error("no files column");
    for (const trash of await column.getByRole("button", { name: /^Supprimer / }).all()) {
      await trash.scrollIntoViewIfNeeded();
      const own = await trash.boundingBox();
      expect(own && inside(own, box)).toBe(true);
    }
    const documentScroll = await page.evaluate(() =>
      [document.scrollingElement, document.querySelector("[data-viewer]")].map((el) =>
        el ? el.scrollHeight - el.clientHeight : 0,
      ),
    );
    expect(documentScroll).toEqual([0, 0]);
    await column.evaluate((el) => el.scrollTo({ top: 0 }));
    await capture(info, "skills-fichiers");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
