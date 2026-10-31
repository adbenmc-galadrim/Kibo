import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

test("un composant retiré déjà posé affiche l'encart et se retire de la page", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const key = projectKey("RET", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Anciens", "Tableau de bord");
  const projects = await rpc(page, { method: "listProjects" });
  const project = (projects as { name: string; id: string }[]).find((p) => p.name === `Kibo ${key}`);
  if (!project) throw new Error("project not listed");
  const snapshot = await rpc(page, { method: "getProject", projectId: project.id });
  const pages = (snapshot as { pages: { id: string; title: string }[] }).pages;
  const pageId = pages.find((p) => p.title === "Anciens")?.id;
  if (!pageId) throw new Error("page not found");
  const add = (component: string, x: number) =>
    rpc(page, {
      method: "command",
      projectId: project.id,
      command: { method: "addInstance", pageId, component, layout: { x, y: 0, w: 6, h: 4 } },
    });
  await add("notes@1.0.0", 0);
  await add("snake@1.0.0", 6);

  const main = page.getByRole("main");
  const notice = main.getByText("Ce composant n'existe plus dans Kibo.");
  await expect(notice).toHaveCount(2);
  await expect(main.locator("code", { hasText: "notes@1.0.0" })).toBeVisible();
  await expect(main.locator("code", { hasText: "snake@1.0.0" })).toBeVisible();
  await expect(main.getByText("Tes notes restent dans le dossier du projet.")).toHaveCount(1);
  await shot(page, info, "composants-retires");
  await main.getByRole("button", { name: "Retirer de la page" }).first().click();
  await expect(notice).toHaveCount(1);
  await expect(main.getByText("Tes notes restent dans le dossier du projet.")).toHaveCount(0);
  await expect(main.locator("code", { hasText: "snake@1.0.0" })).toBeVisible();
  expect(errors).toEqual([]);
});

const RETIRED_URLS = [
  "/#/agents",
  "/#/agents/queue",
  "/#/agents/skills",
  "/#/creations",
  "/#/components",
  "/#/settings/components",
  "/#/settings/sources",
  "/#/settings/domains",
  "/#/settings/sync",
  "/#/settings/security",
  "/#/code",
  "/#/mine",
  "/#/inbox",
  "/#/runs/r1",
  "/#/p/silo/changes",
];

test("les anciennes URL des écrans retirés ramènent à Aujourd'hui", async ({ page }) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Aujourd'hui", exact: true })).toBeVisible();
  for (const url of RETIRED_URLS) {
    await page.goto("about:blank");
    await page.goto(url);
    await expect(page).toHaveURL(/#\/$/);
  }
  const sidebar = page.locator('[data-sidebar="sidebar"]');
  for (const name of [
    "Agents",
    "Files d'attente",
    "Skills",
    "Créations",
    "Composants",
    "Mes tickets",
    "Boîte de réception",
  ])
    await expect(sidebar.getByRole("button", { name, exact: true })).toHaveCount(0);
});
