import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { addComponent, createSidebarPage, pairAndCreateProject } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

let repo: E2eRepo | null = null;
test.afterEach(async () => {
  const created = repo;
  repo = null;
  if (created) await expect(() => created.remove()).toPass();
});

test("onglets épinglés persistés, raccourcis, palette et aperçu de fichier", async ({ page }, info) => {
  const key = projectKey("TAB", info);
  const created = createE2eRepo(key);
  repo = created;
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, `Onglets ${key}`, key, created.repo);
  await page.getByRole("main").getByRole("button", { name: "Nouvelle page" }).click();
  await page.getByLabel("Nom", { exact: true }).fill("Kanban");
  await page.getByRole("radio", { name: "Vue", exact: true }).click();
  await page.getByRole("button", { name: "Créer la page" }).click();

  const bar = page.getByRole("tablist", { name: "Onglets" });
  const kanban = bar.getByRole("tab", { name: `Onglets ${key} · Kanban` });
  await expect(kanban).toHaveAttribute("aria-selected", "true");
  await kanban.click({ button: "right" });
  await page.getByRole("menuitem", { name: /Épingler l'onglet/ }).click();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toHaveText("");

  created.write("README.md", "# test\nligne ajoutée\n");
  await page.getByRole("button", { name: /^Changements/ }).click({ modifiers: ["ControlOrMeta"] });
  const changesTab = bar.getByRole("tab", { name: `Onglets ${key} · Changements` });
  await expect(changesTab).toBeVisible();
  await changesTab.click();
  await expect(page.getByRole("group", { name: /^Modifications \(/ }).getByText("README.md")).toBeVisible();
  await expect(page.getByRole("button", { name: `Commit sur ${created.branch}` })).toBeVisible();
  await shot(page, info, "ecran-20");
  await page
    .getByRole("button", { name: /README\.md/ })
    .first()
    .click();
  await page.getByRole("button", { name: "README.md", exact: true }).last().click();
  const preview = page.getByRole("dialog").filter({ hasText: "README.md" });
  await expect(preview.getByText(/Ligne \d+ · Col \d+/)).toBeVisible();
  await shot(page, info, "ecran-23");
  await preview.getByRole("button", { name: "Ouvrir dans un onglet" }).click();
  await expect(bar.getByRole("tab", { name: "README.md" })).toHaveAttribute("aria-selected", "true");

  await expect
    .poll(async () => JSON.stringify(await rpc(page, { method: "getTabs" })))
    .toContain("README.md");
  await page.reload();
  await expect(bar.getByRole("tab", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await expect(bar.getByRole("tab", { name: "README.md" })).toBeVisible();

  await page.keyboard.press("ControlOrMeta+1");
  await expect(bar.getByRole("tab", { name: "Accueil" })).toHaveAttribute("aria-selected", "true");
  await bar.getByRole("tab", { name: "README.md" }).click();
  await page.keyboard.press("ControlOrMeta+w");
  await expect(bar.getByRole("tab", { name: "README.md" })).toHaveCount(0);
  await changesTab.click({ button: "middle" });
  await expect(changesTab).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await expect(palette.getByText("Récents")).toBeVisible();
  await palette.getByRole("combobox").fill("kanban");
  await expect(palette.getByRole("option", { name: `Onglets ${key} · Kanban` })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toBeHidden();
});

test("onglet fermé : Annuler, ⌘⇧T, et Backspace ne ferme rien", async ({ page }, info) => {
  const key = projectKey("TBC", info);
  await pairAndCreateProject(page, info, key);
  const bar = page.getByRole("tablist", { name: "Onglets" });

  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  const agents = bar.getByRole("tab", { name: "Agents" });
  await expect(agents).toBeVisible();
  await page.keyboard.press("ControlOrMeta+w");
  await expect(agents).toHaveCount(0);
  const toast = page.locator("[data-sonner-toast]").filter({ hasText: "Onglet fermé" });
  await expect(toast).toBeVisible();
  await shot(page, info, "onglet-ferme");
  await toast.getByRole("button", { name: "Annuler" }).click();
  await expect(agents).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ControlOrMeta+w");
  await expect(agents).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+t");
  await expect(agents).toHaveAttribute("aria-selected", "true");

  await createSidebarPage(page, `Kibo ${key}`, "Notes", "Vue");
  await addComponent(page, "Notes");
  const empty = page.getByText("Aucune note dans ce dossier.");
  await expect(empty).toBeVisible();
  const notesTab = bar.getByRole("tab", { name: `Kibo ${key} · Notes` });
  await expect(notesTab).toHaveAttribute("aria-selected", "true");
  await empty.click();
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Delete");
  await expect(empty).toBeVisible();
  await expect(notesTab).toHaveAttribute("aria-selected", "true");
});
