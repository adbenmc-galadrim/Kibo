import { expect, type Locator, type Page, test } from "@playwright/test";
import { createAgent, list, rpc, runState, text } from "./agents-seed";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { capture } from "./visibility-kit";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const PROJECT = "Kibo KIB";
const TITLES = [
  "Monorepo Bun workspaces",
  "Démon : auth par jeton local",
  "Noyau de données",
  "Orchestration des agents",
  "Setup Tauri + sidecar Bun",
  "UI de base",
  "Tokens shadcn + thème sombre",
  "Export Markdown / Obsidian",
  "Watcher git et gh",
  "Adaptateur GitHub Issues",
  "Sandbox iframe des composants",
  "Schéma Loro des tickets (LoroTree)",
  "Snapshots Loro ↔ SQLite",
  "Récepteur de hooks Claude Code",
  "Kanban : drag & drop entre colonnes",
  "Moteur de règles déclaratif",
];

type Kibo = { projectId: string; tickets: Map<string, string>; profileId: string };

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function seed(page: Page, projectId: string): Promise<Kibo> {
  const tickets = new Map<string, string>();
  for (const [i, title] of TITLES.entries()) {
    const ticket = await rpc(page, {
      method: "command",
      projectId,
      command: { method: "createTicket", title, statusId: "todo" },
    });
    tickets.set(`KIB-${i + 1}`, text(ticket, "id"));
  }
  const profileId = await createAgent(page, {
    name: "livraison",
    description: "Livre un ticket en TDD avec des commits propres",
    model: "opus",
    settings: { permissionMode: "acceptEdits", workspace: "isolated", maxParallel: 1 },
  });
  return { projectId, tickets, profileId };
}

async function assignDone(page: Page, kibo: Kibo, key: string): Promise<{ id: string; label: string }> {
  const run = await rpc(page, {
    method: "assignAgent",
    projectId: kibo.projectId,
    ticketId: kibo.tickets.get(key),
    profileId: kibo.profileId,
    brief: "",
  });
  await expect.poll(() => runState(page, key), { timeout: 30_000 }).toBe("done");
  return { id: text(run, "id"), label: text(run, "label") };
}

async function pendingBatch(page: Page, projectId: string): Promise<void> {
  await expect
    .poll(
      async () => {
        const view = await rpc(page, { method: "getProjectAgent", projectId });
        const first = list(view, "batches")[0];
        return first === undefined ? null : text(first, "status");
      },
      { timeout: 30_000 },
    )
    .toBe("pending");
}

const panelOf = (page: Page): Locator => page.getByRole("dialog", { name: `Agent de projet · ${PROJECT}` });
const signalLine = (scope: Locator | Page) =>
  scope.getByText("Signal à l'agent de projet · Ticket à créer · « Tests du récepteur de hooks »");

test("un run signale à l'agent de projet, qui se réveille et propose un lot que l'éditeur valide", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await pairAndCreateProject(page, info, "KIB");
  const kibo = await seed(page, projectIdOf(page));
  await createPage(page, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const kanbanUrl = page.url();
  const kanban = page.getByRole("main");
  const showAll = async () => {
    const all = kanban.getByRole("radio", { name: "Tous" });
    if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  };
  await showAll();
  await expect(kanban.getByRole("region", { name: "À faire" }).getByText("KIB-16")).toBeVisible();

  const run = await assignDone(page, kibo, "KIB-14");
  await pendingBatch(page, kibo.projectId);

  await page.goto(`/#/runs/${run.id}`);
  const feed = page.getByRole("region", { name: "Fil narratif" });
  await expect(signalLine(feed)).toBeVisible();
  await expect(feed.getByText("Signal à l'agent de projet · Blocage", { exact: false })).toBeVisible();
  await capture(page, info, "190");

  await page.goto(kanbanUrl);
  await showAll();
  const badge = page.getByRole("button", { name: "Ouvrir la boîte à signaux" });
  await expect(page.getByRole("button", { name: "Agent de projet · 3 signaux en boîte" })).toBeVisible();
  await expect(badge).toHaveText("3");
  await capture(page, info, "191");

  await page.goto(`/#/p/${kibo.projectId}/t/${kibo.tickets.get("KIB-14")}`);
  await page.getByRole("tab", { name: "Activité" }).click();
  const line = signalLine(page.getByRole("region", { name: "Chronologie", exact: true }));
  await expect(line).toBeVisible();
  await capture(page, info, "190b");
  await line.click();

  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Signaux · 3" })).toHaveAttribute("aria-selected", "true");
  const box = panel.getByRole("region", { name: "En boîte · 3" });
  await expect(box.getByRole("listitem")).toHaveCount(3);
  await expect(box.getByText("Ticket à créer")).toBeVisible();
  await expect(box.getByText("Blocage")).toBeVisible();
  await expect(box.getByText("Contexte")).toBeVisible();
  await expect(box.getByRole("button", { name: run.label }).first()).toBeVisible();
  await expect(panel.getByText("Réveil automatique", { exact: true })).toBeVisible();
  await capture(page, info, "189a");

  await panel.getByRole("tab", { name: "Conversation" }).click();
  await expect(panel.getByText("Réveil automatique · 1 signal")).toBeVisible();
  const card = panel.getByRole("region", { name: "Lot n° 1" });
  await expect(card.getByText("après réveil", { exact: false })).toBeVisible();
  await expect(card.locator("p").filter({ hasText: "signal Ticket à créer de" })).toContainText(run.label);
  await expect(card.getByRole("group", { name: "Signaux" })).toBeVisible();
  await capture(page, info, "189");

  await card.getByRole("button", { name: "Valider (3)" }).click();
  await expect(card.getByText("Appliqué", { exact: true })).toBeVisible();
  await panel.getByRole("tab", { name: "Signaux" }).click();
  const closed = panel.getByRole("region", { name: "Traités" });
  await expect(closed.getByText("traité dans le lot n° 1")).toHaveCount(2);
  await expect(closed.getByText("sans suite, lot n° 1")).toBeVisible();
  await expect(panel.getByRole("region", { name: /^En boîte/ })).toHaveCount(0);
  await expect(badge).toHaveCount(0);
  await capture(page, info, "189b");

  await page.goto(kanbanUrl);
  await showAll();
  await expect(kanban.getByRole("region", { name: "Bloqué" }).getByText("KIB-16")).toBeVisible();
  await expect(kanban.getByText("KIB-17")).toBeVisible();

  await assignDone(page, kibo, "KIB-16");
  await expect(badge).toHaveText("3");
  await badge.click();
  await expect(panel.getByRole("tab", { name: "Signaux · 3" })).toHaveAttribute("aria-selected", "true");
  const fresh = panel.getByRole("region", { name: "En boîte · 3" });
  await fresh
    .getByRole("listitem")
    .filter({ hasText: "Contexte" })
    .getByRole("button", { name: "Ignorer" })
    .click();
  await expect(panel.getByRole("region", { name: "En boîte · 2" })).toBeVisible();
  await expect(panel.getByRole("tab", { name: "Signaux · 2" })).toBeVisible();
  await expect(badge).toHaveText("2");
  await expect(
    panel.getByRole("region", { name: "Traités" }).getByText("ignoré", { exact: true }),
  ).toBeVisible();
  await capture(page, info, "189c");
});
