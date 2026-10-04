import { expect, type Page, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 1100 } });

async function seedDashboard(page: Page): Promise<{ projectId: string; pageId: string }> {
  const user = text(await rpc(page, { method: "getSession" }), "user");
  const created = await rpc(page, {
    method: "createProject",
    name: "Sélection",
    key: "SEL",
    folder: null,
    color: "#F97316",
  });
  const projectId = text(created, "id");
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const assignee = { kind: "human", ref: user };
  const ids: string[] = [];
  for (const title of ["Schéma de sélection", "Bus de la page", "Puce partagée"]) {
    ids.push(text(await command({ method: "createTicket", title, assignee }), "id"));
  }
  await command({ method: "addLink", from: ids[0], to: ids[1], type: "blocks" });
  const pageId = text(await command({ method: "addPage", title: "Suivi", kind: "dashboard" }), "id");
  await command({
    method: "addInstance",
    pageId,
    component: "graph@1.0.0",
    layout: { x: 0, y: 0, w: 6, h: 6 },
  });
  await command({
    method: "addInstance",
    pageId,
    component: "kanban@1.0.0",
    layout: { x: 0, y: 6, w: 12, h: 6 },
  });
  return { projectId, pageId };
}

test("sélection partagée : le graphe sélectionne, le Kanban suit", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  const { projectId, pageId } = await seedDashboard(page);
  await page.goto(`/#/p/${projectId}/${encodeURIComponent(pageId)}`);

  const canvas = page.getByRole("region", { name: "Graphe des dépendances" });
  const card = (title: string) => page.getByRole("article", { name: new RegExp(title) });
  await expect(canvas.getByRole("button", { name: /Schéma de sélection/ })).toBeVisible();
  await expect(card("Bus de la page")).toBeVisible();
  await shot(page, info, "selection-aucune");

  await canvas.getByRole("button", { name: /Schéma de sélection/ }).click();
  await expect(card("Schéma de sélection")).toHaveAttribute("data-selected", "true");
  await expect(card("Bus de la page")).toHaveAttribute("data-selected", "false");
  await expect(page.getByText("1 sélectionné")).toBeVisible();
  await shot(page, info, "selection-graphe-kanban");

  await page.getByRole("button", { name: "Effacer la sélection" }).click();
  await expect(page.locator("article[data-selected='true']")).toHaveCount(0);
  await expect(page.getByText("1 sélectionné")).toHaveCount(0);
  await expect(canvas.locator("[data-selected='true']")).toHaveCount(0);
});
