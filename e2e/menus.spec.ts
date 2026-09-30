import { expect, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { addComponent, createPage } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("menus des pages, fiche ticket éditable, annulation d'un fichier", async ({ page }, info) => {
  const key = projectKey("MNU", info);
  const created = createE2eRepo(key);
  repo = created;
  const name = `Menus ${key}`;
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, name, key, created.repo);

  await createPage(page, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const bar = page.getByRole("tablist", { name: "Onglets" });
  await expect(bar.getByRole("tab", { name: `${name} · Kanban` })).toHaveAttribute("aria-selected", "true");

  const projects = await rpc(page, { method: "listProjects" });
  const project = (projects as { name: string; id: string }[]).find((p) => p.name === name);
  if (!project) throw new Error("project not listed");
  const ticket = await rpc(page, {
    method: "command",
    projectId: project.id,
    command: { method: "createTicket", title: "Schéma Loro des tickets", statusId: "todo" },
  });
  const ticketKey = text(ticket, "key");

  const card = page.getByRole("button", { name: "Schéma Loro des tickets", exact: true });
  await page.getByRole("button", { name: "Tous", exact: true }).click();
  await expect(card).toBeVisible();
  await card.click();
  const sheet = page.getByRole("dialog").filter({ hasText: ticketKey });
  await sheet.getByRole("button", { name: "Modifier le titre" }).click();
  const title = sheet.getByRole("textbox", { name: "Titre" });
  await title.fill("Schéma Loro des tickets (LoroTree)");
  await sheet.getByRole("button", { name: `Actions ${ticketKey}` }).click();
  await expect(page.getByRole("menuitem", { name: "Supprimer…" })).toBeVisible();
  await expect(title).toBeHidden();
  await shot(page, info, "ecran-98");
  await page.keyboard.press("Escape");
  await expect(sheet.getByRole("button", { name: "Modifier le titre" })).toHaveText(
    "Schéma Loro des tickets (LoroTree)",
  );
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Schéma Loro des tickets (LoroTree)", exact: true }),
  ).toBeVisible();

  const sidebarPage = page.getByRole("button", { name: "Kanban", exact: true });
  await sidebarPage.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Renommer…" })).toBeVisible();
  await shot(page, info, "ecran-101");
  await page.getByRole("menuitem", { name: "Renommer…" }).click();
  const rename = page.getByRole("dialog", { name: "Renommer la page" });
  await rename.getByLabel("Nom").fill("Tableau");
  await rename.getByRole("button", { name: "Renommer" }).click();
  await expect(rename).toBeHidden();
  await expect(bar.getByRole("tab", { name: `${name} · Tableau` })).toHaveAttribute("aria-selected", "true");

  created.write("README.md", "# test\nligne ajoutée\n");
  created.write("docs/notes.md", "# notes\n");
  await page.getByRole("button", { name: /^Changements/ }).click();
  const unstaged = page.getByRole("group", { name: "Non indexés" });
  await expect(unstaged.getByText("README.md")).toBeVisible();
  await expect(unstaged.getByText("notes.md")).toBeVisible();
  await unstaged
    .getByRole("button", { name: /notes\.md/ })
    .first()
    .click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Annuler les changements…" })).toBeVisible();
  await shot(page, info, "ecran-104");
  await page.getByRole("menuitem", { name: "Annuler les changements…" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Annuler les changements de notes.md ?" });
  await expect(confirm.getByText("notes.md est nouveau : il sera supprimé du disque.")).toBeVisible();
  await confirm.getByRole("button", { name: "Annuler les changements" }).click();
  await expect(confirm).toBeHidden();
  await expect(unstaged.getByText("notes.md")).toBeHidden();
  await expect(unstaged.getByText("README.md")).toBeVisible();
  expect(created.git("status", "--porcelain")).not.toContain("notes.md");

  const renamed = page.getByRole("button", { name: "Tableau", exact: true });
  await renamed.click();
  await expect(bar.getByRole("tab", { name: `${name} · Tableau` })).toHaveAttribute("aria-selected", "true");
  await renamed.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Supprimer…" }).click();
  const remove = page.getByRole("alertdialog", { name: "Supprimer la page Tableau ?" });
  await expect(remove.getByText(/1 widget/)).toBeVisible();
  await remove.getByRole("button", { name: "Supprimer" }).click();
  await expect(remove).toBeHidden();
  await bar.getByRole("tab", { name: "Page introuvable" }).click();
  await expect(
    page.getByRole("main").getByRole("paragraph").filter({ hasText: "Page introuvable" }),
  ).toBeVisible();
});
