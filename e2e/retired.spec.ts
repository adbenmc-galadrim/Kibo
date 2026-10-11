import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

test("un jeu ou un serpent déjà posé s'affiche absent et se retire de la page", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const key = projectKey("RET", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Jeux", "Tableau de bord");
  const projects = await rpc(page, { method: "listProjects" });
  const project = (projects as { name: string; id: string }[]).find((p) => p.name === `Kibo ${key}`);
  if (!project) throw new Error("project not listed");
  const snapshot = await rpc(page, { method: "getProject", projectId: project.id });
  const pages = (snapshot as { pages: { id: string; title: string }[] }).pages;
  const pageId = pages.find((p) => p.title === "Jeux")?.id;
  if (!pageId) throw new Error("page not found");
  const add = (component: string, x: number) =>
    rpc(page, {
      method: "command",
      projectId: project.id,
      command: { method: "addInstance", pageId, component, layout: { x, y: 0, w: 6, h: 4 } },
    });
  await add("itch@1.0.0", 0);
  await add("snake@1.0.0", 6);

  const main = page.getByRole("main");
  await expect(main.getByText("Composant absent : itch@1.0.0")).toBeVisible();
  await expect(main.getByText("Composant absent : snake@1.0.0")).toBeVisible();
  await shot(page, info, "composants-retires");
  await main.getByRole("button", { name: "Actions itch@1.0.0" }).click();
  await page.getByRole("menuitem", { name: "Retirer de la page…" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Retirer itch@1.0.0 de la page ?" });
  await confirm.getByRole("button", { name: "Retirer", exact: true }).click();
  await expect(main.getByText("Composant absent : itch@1.0.0")).toHaveCount(0);
  await expect(main.getByText("Composant absent : snake@1.0.0")).toBeVisible();
  expect(errors).toEqual([]);
});
