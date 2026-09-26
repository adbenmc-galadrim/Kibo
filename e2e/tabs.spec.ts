import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { createE2eRepo, type E2eRepo } from "./git-repo";
import { createRepoProject, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

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
  await page.getByLabel("Nom").fill("Kanban");
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
  await expect(page.getByRole("group", { name: "Non indexés" }).getByText("README.md")).toBeVisible();
  await expect(page.getByRole("button", { name: `Commit sur ${created.branch}` })).toBeVisible();
  await shot(page, info, "ecran-20");
  await page
    .getByRole("button", { name: /README\.md/ })
    .first()
    .click();
  await page.getByRole("button", { name: "README.md", exact: true }).last().click();
  const preview = page.getByRole("dialog").filter({ hasText: "README.md" });
  await expect(preview.getByText(/Ligne \d+, col \d+/)).toBeVisible();
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
