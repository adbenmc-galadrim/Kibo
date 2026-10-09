import { expect, type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { shot } from "./repo-project";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const PROJECT = "Kibo KIB";

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function seed(page: Page, projectId: string): Promise<void> {
  for (const title of ["Récepteur de hooks", "Documentation"])
    await rpc(page, {
      method: "command",
      projectId,
      command: { method: "createTicket", title, statusId: "todo" },
    });
  await rpc(page, {
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "opus",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 1,
      },
    },
  });
}

const panelOf = (page: Page): Locator => page.getByRole("dialog", { name: `Agent de projet · ${PROJECT}` });

async function expectBelow(panel: Locator, header: Locator): Promise<void> {
  const panelBox = await panel.boundingBox();
  const headerBox = await header.boundingBox();
  if (!panelBox || !headerBox) throw new Error("panel or header not laid out");
  expect(panelBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
  expect(panelBox.width).toBe(440);
}

async function say(panel: Locator, message: string): Promise<void> {
  await panel.getByRole("textbox", { name: "Message à l'agent de projet" }).fill(message);
  await panel.getByRole("button", { name: "Envoyer" }).click();
}

test("l'agent de projet lit le projet, propose un lot, et l'éditeur le valide d'un clic", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await pairAndCreateProject(page, info, "KIB");
  const projectId = projectIdOf(page);
  await seed(page, projectId);
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Kanban");
  const kanban = page.locator("[data-instance]").first();
  const all = kanban.getByRole("radio", { name: "Tous" });
  if ((await all.getAttribute("aria-checked")) !== "true") await all.click();
  await expect(kanban.getByRole("region", { name: "À faire" }).getByText("KIB-1")).toBeVisible();

  const button = page.getByRole("button", { name: "Agent de projet", exact: true });
  await button.click();
  const panel = panelOf(page);
  await expect(panel).toBeVisible();
  await expect(button).toBeVisible();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Partager", exact: true })).toBeVisible();
  await expectBelow(panel, button);
  await button.click();
  await expect(panel).toBeHidden();
  await button.click();
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Fermer le panneau" }).click();
  await expect(panel).toBeHidden();
  await page.keyboard.press("ControlOrMeta+j");
  await expect(panel).toBeVisible();

  await say(panel, "Où en est-on ?");
  await expect(panel.getByText("J'ai proposé un lot de 5 actions.")).toBeVisible({ timeout: 30_000 });
  const card = panel.getByRole("region", { name: "Lot n° 1" });
  await expect(card).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Agent de projet · Un lot attend ta validation/ }),
  ).toBeVisible();
  await shot(page, info, "ecran-174");
  await card.scrollIntoViewIfNeeded();
  await card.getByRole("checkbox", { name: /Faut-il la doc/ }).click();
  await shot(page, info, "ecran-175");
  await card.getByRole("button", { name: "Valider (4)" }).click();
  await expect(card.getByText("Appliqué en partie")).toBeVisible();
  await expect(card.getByText("Appliquée", { exact: true })).toHaveCount(4);
  await expect(card.getByText("Ignorée", { exact: true })).toHaveCount(1);
  await expect(card.getByText("KIB-3")).toBeVisible();
  await expect(card.getByRole("button", { name: /^Valider/ })).toHaveCount(0);
  await shot(page, info, "ecran-175b");
  await expect(kanban.getByRole("region", { name: "En cours" }).getByText("KIB-1")).toBeVisible();

  await say(panel, "Propose un lot invalide");
  await expect(panel.getByText("Lot corrigé.")).toBeVisible({ timeout: 30_000 });
  const second = panel.getByRole("region", { name: "Lot n° 2" });
  await expect(second).toBeVisible();
  await expect(panel.getByRole("region", { name: /^Lot n° \d+$/ })).toHaveCount(2);
  await second.getByRole("button", { name: "Refuser" }).click();
  await second.getByLabel("Commentaire pour l'agent (facultatif)").fill("Pas cette semaine");
  await second.getByRole("button", { name: "Confirmer le refus" }).click();
  await expect(second.getByText("Refusé", { exact: true })).toBeVisible();
  await expect(panel.getByText("Compris, je retire la proposition.")).toBeVisible({ timeout: 30_000 });

  await panel.getByRole("button", { name: "Actions de l'agent de projet" }).click();
  await page.getByRole("menuitem", { name: "Nouvel agent de projet" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Nouvel agent" }).click();
  await expect(panel.getByRole("region", { name: /^Lot n° / })).toHaveCount(0);
  await panel.getByRole("button", { name: "Actions de l'agent de projet" }).click();
  await page.getByRole("menuitem", { name: "Anciens agents" }).click();
  await expect(panel.getByRole("button", { name: /^Session du / })).toHaveCount(1);
  await shot(page, info, "ecran-176");
  await panel.getByRole("button", { name: /^Session du / }).click();
  await expect(panel.getByText("Ancien agent · lecture seule")).toBeVisible();
  await expect(panel.getByRole("region", { name: "Lot n° 1" })).toBeVisible();

  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await expect(page.getByText(`Agent de projet · ${PROJECT}`).first()).toBeVisible();
  await page.getByRole("button", { name: "Modifier le profil Agent de projet" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("1 tour à la fois par projet")).toBeVisible();
  await shot(page, info, "ecran-177");
});
