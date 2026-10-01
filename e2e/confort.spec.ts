import { rmSync } from "node:fs";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { assign, createGitRepo, rpc, type Seeded, seedWorkspace } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { addComponent, createSidebarPage } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.setTimeout(60_000);
test.use({ viewport: { width: 1440, height: 900 } });

const cleanups: (() => void)[] = [];
test.afterAll(async () => {
  for (const cleanup of cleanups.splice(0)) await expect(() => cleanup()).toPass();
});

let seeded: Seeded | null = null;

async function pair(page: Page) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  await page.goto("/#/");
}

async function seed(page: Page): Promise<Seeded> {
  if (seeded) return seeded;
  const folder = createGitRepo();
  cleanups.push(() => rmSync(folder, { recursive: true, force: true }));
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
        workspace: "isolated",
      },
    },
  });
  seeded = await seedWorkspace(page, folder);
  return seeded;
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element has no box");
  return box;
}

async function dragBelow(page: Page, source: Locator, target: Locator) {
  const from = await boxOf(source);
  const to = await boxOf(target);
  const grip = { x: from.x + from.width / 2, y: from.y + 14 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x, grip.y + 10, { steps: 4 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 4, { steps: 12 });
  await page.mouse.up();
}

function newRepo(key: string): E2eRepo {
  const repo = createE2eRepo(key);
  cleanups.push(() => repo.remove());
  return repo;
}

test("composants : recherche, filtres, tri et volet « Utilisé dans »", async ({ page }, info) => {
  await pair(page);
  await rpc(page, { method: "createProject", name: "Confort", key: "CNF", folder: null, color: "#6366F1" });
  await createSidebarPage(page, "Confort", "Tableau", "Vue");
  await addComponent(page, "Kanban");

  await page.goto("/#/components");
  await expect(page.getByRole("heading", { level: 1, name: "Composants" }).last()).toBeVisible();
  await page.getByRole("searchbox", { name: "Rechercher un composant" }).fill("kanban");
  await page.getByRole("radiogroup", { name: "Origine" }).getByRole("radio", { name: "Kibo" }).click();
  await page.getByRole("button", { name: "Trier par Utilisé dans" }).click();
  const row = page.getByRole("row").filter({ hasText: /Kanban/ });
  await expect(row).toHaveCount(1);
  await row.getByRole("button", { name: "1 page · 1 projet" }).click();
  const usages = page.getByRole("dialog", { name: "Utilisé dans" });
  await expect(usages.getByText("Kanban 1.0.0")).toBeVisible();
  await shot(page, info, "ecran-116");
  await usages.getByRole("button", { name: "Confort › Tableau" }).click();
  await expect(usages).toBeHidden();
  await expect(page).toHaveURL(/#\/p\//);
  await expect(page.getByRole("tab", { name: /Tableau/, selected: true })).toBeVisible();
});

test("synchronisation : état vide et connexion d'un autre appareil", async ({ page }, info) => {
  await pair(page);
  await page.goto("/#/settings/sync");
  await expect(page.getByText("Partage tes projets entre tes appareils et avec ton équipe.")).toBeVisible();
  await expect(page.getByText("Se connecter à un serveur")).toBeVisible();
  await expect(page.getByText("C'est mon autre appareil")).toBeVisible();
  await shot(page, info, "ecran-119");
  await page.getByRole("button", { name: "Entrer le code" }).click();
  const dialog = page.getByRole("dialog", { name: "Se connecter à un serveur" });
  await expect(dialog.getByLabel("Adresse du serveur")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Options avancées" })).toHaveAttribute(
    "aria-expanded",
    "false",
  );
  await shot(page, info, "ecran-120");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("agents : historique cliquable et confirmation d'arrêt", async ({ page }, info) => {
  await pair(page);
  const seededWorkspace = await seed(page);
  await assign(page, seededWorkspace, 12, "opus-dev", "waiting_input");
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Filtrer par état" })
    .getByRole("radio", { name: "Tous" })
    .click();
  await page.getByRole("button", { name: /^opus-dev · KIB-12/ }).click();
  const drawer = page.getByRole("region", { name: "Agents" });
  await expect(drawer.getByRole("list", { name: /^Journal de opus-dev-\d+$/ })).toBeVisible();
  await drawer.getByRole("button", { name: "Arrêter", exact: true }).click();
  const confirm = page.getByRole("alertdialog", { name: /^Arrêter le run opus-dev-\d+ sur KIB-12 \?$/ });
  await expect(confirm.getByText("L'agent est interrompu ; le ticket reste assigné.")).toBeVisible();
  await shot(page, info, "ecran-121");
  await confirm.getByRole("button", { name: "Annuler" }).click();
  await expect(confirm).toBeHidden();
  await expect(drawer.getByRole("button", { name: "Arrêter", exact: true })).toBeVisible();
});

test("changements en toutes lettres, retour à la ligne mémorisé et recherche", async ({ page }, info) => {
  const key = projectKey("CHG", info);
  const repo = newRepo(key);
  await pair(page);
  await createRepoProject(page, `Code ${key}`, key, repo.repo);
  repo.write("README.md", "# kibo\n\nkibo garde kibo en local.\n");
  await page.getByRole("button", { name: /^Changements/ }).click();
  const unstaged = page.getByRole("group", { name: "Modifications (1)" });
  await expect(unstaged.getByText("Modifié")).toBeVisible();
  await unstaged.getByRole("button", { name: "Actions README.md" }).click();
  await page.getByRole("menuitem", { name: "Ajouter au commit" }).click();
  const staged = page.getByRole("group", { name: "Dans le prochain commit (1)" });
  await expect(staged.getByText("README.md")).toBeVisible();
  await staged
    .getByRole("button", { name: /README\.md/ })
    .first()
    .click();
  const wrap = page.getByRole("switch", { name: "Retour à la ligne" });
  await expect(wrap).toBeChecked();
  await wrap.click();
  await expect(wrap).not.toBeChecked();
  await shot(page, info, "ecran-122");
  await page.reload();
  await page
    .getByRole("group", { name: "Dans le prochain commit (1)" })
    .getByRole("button", { name: /README\.md/ })
    .first()
    .click();
  await expect(page.getByRole("switch", { name: "Retour à la ligne" })).not.toBeChecked();

  await page.getByRole("button", { name: "Actions README.md" }).click();
  await page.getByRole("menuitem", { name: "Ouvrir dans un onglet" }).click();
  await page.getByRole("button", { name: /^Rechercher \(/ }).click();
  await page.getByRole("searchbox", { name: "Rechercher ou :ligne" }).fill("kibo");
  await expect(page.getByText("1 / 3", { exact: true })).toBeVisible();
  await shot(page, info, "ecran-124");
});

test("arbre Tickets filtré et Kanban réordonné", async ({ page }, info) => {
  await pair(page);
  const { projectId, board } = await seed(page);
  await page.goto(`/#/p/${projectId}/${encodeURIComponent(board)}`);
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  await sidebar.getByRole("button", { name: "Tickets", exact: true }).click();
  const tree = page.getByRole("region", { name: "Tickets" });
  await tree.getByRole("searchbox", { name: "Rechercher (clé ou titre)" }).fill("schéma");
  await expect(tree.getByText("Schéma Loro des tickets (LoroTree)")).toBeVisible();
  await expect(tree.getByText("Noyau de données")).toBeVisible();
  await expect(tree.getByText("Orchestration des agents")).toHaveCount(0);
  await shot(page, info, "ecran-125");

  await sidebar.getByRole("button", { name: "Kanban", exact: true }).click();
  const filter = page.getByRole("radiogroup", { name: "Tickets affichés" });
  await expect(page.getByText(/^\d+ \/ 22 · Moi \+ agents$/)).toBeVisible();
  await page.getByRole("button", { name: /masqués · Tout afficher$/ }).click();
  await expect(filter.getByRole("radio", { name: "Tous" })).toBeChecked();
  await expect(page.getByText("22 / 22 · Tous")).toBeVisible();

  await page.getByRole("button", { name: "Nouveau ticket dans Bloqué" }).click();
  const create = page.getByRole("dialog", { name: "Nouveau ticket" });
  await expect(create.getByLabel("Motif")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(create).toBeHidden();

  const todo = page.getByRole("region", { name: "À faire" });
  const keys = () =>
    todo.getByRole("article").evaluateAll((cards) => cards.map((c) => c.getAttribute("data-key")));
  await expect.poll(keys).toHaveLength(4);
  const before = await keys();
  const moved = before.filter((key) => key !== "KIB-15");
  moved.splice(moved.indexOf("KIB-18") + 1, 0, "KIB-15");
  expect(moved).not.toEqual(before);
  await dragBelow(
    page,
    todo.getByRole("article", { name: /^KIB-15 / }),
    todo.getByRole("article", { name: /^KIB-18 / }),
  );
  await expect.poll(keys).toEqual(moved);
  await shot(page, info, "ecran-126");
  await page.reload();
  await page
    .getByRole("radiogroup", { name: "Tickets affichés" })
    .getByRole("radio", { name: "Tous" })
    .click();
  await expect.poll(keys).toEqual(moved);
});
