import { expect, type Page, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { pairAndCreateProject } from "./helpers";
import { projectKey } from "./repo-project";
import { capture, WIDE } from "./visibility-kit";

test.use({ viewport: WIDE });
test.describe.configure({ mode: "serial" });

type Ensembles = { page: Page; key: string; projectId: string; pages: Record<View, string>; feature: string };
type View = "tickets" | "kanban" | "graph";

const COMPONENTS: Record<View, [string, string]> = {
  tickets: ["Tickets", "tickets@1.0.0"],
  kanban: ["Kanban", "kanban@1.0.0"],
  graph: ["Graphe", "graph@1.0.0"],
};

let e: Ensembles;

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function seed(
  page: Page,
  projectId: string,
): Promise<{ pages: Record<View, string>; feature: string }> {
  const command = async (cmd: Record<string, unknown>) =>
    text(await rpc(page, { method: "command", projectId, command: cmd }), "id");
  const ticket = (title: string, parentId: string | null, statusId = "todo") =>
    command({ method: "createTicket", title, parentId, statusId });
  const c4 = await ticket("Parcours de livraison", null);
  await ticket("Bouton Livrer", c4, "done");
  const steps = await ticket("Étapes visibles", c4);
  await ticket("Puce d'étape", steps, "in_progress");
  await ticket("Ligne de la fiche", steps);
  await ticket("Un seul worktree", c4);
  const after = await ticket("Après le parcours", null);
  await command({ method: "addLink", from: c4, to: after, type: "blocks" });
  await command({ method: "updateTicket", ticketId: c4, description: "Tout le parcours de livraison." });
  const pages: Partial<Record<View, string>> = {};
  for (const [view, [title, component]] of Object.entries(COMPONENTS)) {
    const pageId = await command({ method: "addPage", title, kind: "view" });
    await command({ method: "addInstance", pageId, component, config: { filter: "all" } });
    Object.assign(pages, { [view]: pageId });
  }
  const { tickets, kanban, graph } = pages;
  if (!tickets || !kanban || !graph) throw new Error("pages not created");
  return { pages: { tickets, kanban, graph }, feature: c4 };
}

const open = async (view: View) => {
  await e.page.goto(`/#/p/${e.projectId}/${encodeURIComponent(e.pages[view])}`);
};
const shoot = (screen: string) => capture(e.page, test.info(), screen);
const main = () => e.page.getByRole("main");

test.beforeAll(async ({ browser }, info) => {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: WIDE });
  const page = await context.newPage();
  const key = projectKey("ENS", info);
  await pairAndCreateProject(page, info, key);
  const projectId = projectIdOf(page);
  e = { page, key, projectId, ...(await seed(page, projectId)) };
});

test.afterAll(async () => {
  await e?.page.context().close();
});

test("220 · la page Tickets liste les sous-tickets à la place de l'ensemble, avec sa puce", async () => {
  await open("tickets");
  const tree = main().getByRole("region", { name: "Tickets" });
  await expect(tree.getByRole("button", { name: "Un seul worktree" })).toBeVisible();
  for (const title of ["Bouton Livrer", "Puce d'étape", "Ligne de la fiche", "Après le parcours"])
    await expect(tree.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(tree.getByRole("button", { name: "Parcours de livraison", exact: true })).toHaveCount(0);
  await expect(tree.getByRole("button", { name: "Étapes visibles", exact: true })).toHaveCount(0);
  const c4 = "Ouvrir la fonctionnalité F1 · Parcours de livraison";
  await expect(tree.getByRole("button", { name: c4 })).toHaveCount(4);
  await expect(
    tree.getByRole("button", { name: /^Ouvrir la fonctionnalité .* · Étapes visibles$/ }),
  ).toHaveCount(0);
  await shoot("220");
});

test("220b · le Kanban n'a pas de carte pour un ensemble", async () => {
  await open("kanban");
  await expect(main().getByRole("article", { name: /Un seul worktree/ })).toBeVisible();
  await expect(main().getByRole("article")).toHaveCount(5);
  await expect(main().getByRole("article", { name: /Parcours de livraison/ })).toHaveCount(0);
  const card = main().getByRole("article", { name: /Puce d'étape/ });
  await expect(
    card.getByRole("button", { name: `Ouvrir l'ensemble ${e.key}-3 · Étapes visibles` }),
  ).toHaveText(`${e.key}-3`);
  await shoot("220b");
});

test("220c · le graphe cadre les sous-tickets de chaque ensemble", async () => {
  await open("graph");
  const canvas = main().getByRole("region", { name: "Graphe des dépendances" });
  await expect(canvas.getByRole("button", { name: /Un seul worktree$/ })).toBeVisible();
  await expect(canvas.locator(`[data-frame="${e.key}-1"]`)).toContainText(
    `${e.key}-1 · Parcours de livraison · 1/3`,
  );
  await expect(canvas.locator(`[data-frame="${e.key}-3"]`)).toContainText(
    `${e.key}-3 · Étapes visibles · 0/2`,
  );
  await expect(canvas.getByRole("button", { name: /Parcours de livraison$/ })).toHaveCount(0);
  await canvas.getByRole("button", { name: "Tout voir" }).click();
  await shoot("220c");
  await canvas.getByRole("button", { name: `Replier ${e.key}-3` }).click();
  await expect(canvas.getByRole("button", { name: `Déplier ${e.key}-3` })).toHaveText(`${e.key}-3 · 0/2`);
  await canvas.getByRole("button", { name: `Déplier ${e.key}-3` }).click();
});

test("220d · la fiche d'un ensemble : avancement, sous-tickets, description, aucun lancement", async () => {
  await open("tickets");
  const tree = main().getByRole("region", { name: "Tickets" });
  await tree
    .getByRole("button", { name: "Ouvrir la fonctionnalité F1 · Parcours de livraison" })
    .first()
    .click();
  const sheet = e.page.getByRole("dialog").filter({ hasText: "Fonctionnalité · F1" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("1 étape livrée sur 3")).toBeVisible();
  await expect(sheet.getByText("ouverte", { exact: true })).toBeVisible();
  const children = sheet.getByRole("listitem");
  await expect(children).toHaveText([
    new RegExp(`^Bouton Livrer${e.key}-2Terminé`),
    new RegExp(`^2Étapes visibles${e.key}-3En cours`),
    new RegExp(`^3Un seul worktree${e.key}-6À faire`),
  ]);
  await expect(sheet.getByText("Tout le parcours de livraison.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Assigner à un agent" })).toHaveCount(0);
  await expect(sheet.getByRole("combobox", { name: "Statut" })).toHaveCount(0);
  await expect(
    rpc(e.page, { method: "deliver", projectId: e.projectId, ticketId: e.feature }),
  ).rejects.toThrow("AGENT_EXECUTION_REMOVED");
  await shoot("220d");
});
