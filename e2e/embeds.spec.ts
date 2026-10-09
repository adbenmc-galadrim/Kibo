import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type FrameLocator, type Locator, type Page, type TestInfo, test } from "@playwright/test";
import { PENPOT_IDS, penpotBoardUrl } from "../packages/daemon/src/testing/penpot-ids";
import { createE2eRepo } from "./git-repo";
import { addComponent, createPage } from "./helpers";
import { createRepoProject, projectKey, shot } from "./repo-project";
import {
  E2E_PENPOT_TOKEN,
  E2E_TOKEN,
  fakeBranchStorybookPort,
  fakeItchPort,
  fakePenpotPort,
  fakeStorybookPort,
} from "./token";

test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

const GAME_CODE =
  '<iframe frameborder="0" src="https://itch.io/embed-upload/1?color=333333" allowfullscreen="" width="640" height="380">' +
  '<a href="https://sigmatronic.itch.io/una-war">Play una-war on itch.io</a></iframe>';
const REFUSED_GAME = "https://itch.io/embed-upload/2?color=333333";
const STORY = "screens-home--default";

const portOf = (baseURL: string | undefined) => Number(new URL(baseURL ?? "").port);
const local = (port: number) => `http://127.0.0.1:${port}`;

async function openProject(page: Page, info: TestInfo, base: string) {
  const key = projectKey(base, info);
  const repo = createE2eRepo(key);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  const html = page.locator("html");
  if (info.project.name.endsWith("dark")) await expect(html).toHaveClass(/dark/);
  else await expect(html).not.toHaveClass(/dark/);
  await createRepoProject(page, `Kibo ${key}`, key, repo.repo);
  await createPage(page, "Jeux et maquettes", "Tableau de bord");
  return { key, repo, name: `Kibo ${key}` };
}

async function openSettings(page: Page, title: string) {
  await page
    .getByRole("main")
    .getByRole("button", { name: `Actions ${title}` })
    .last()
    .click();
  await page.getByRole("menuitem", { name: "Réglages…" }).click();
  return page.getByRole("dialog");
}

async function setFormat(page: Page, title: string, format: RegExp) {
  await page.getByRole("button", { name: "Modifier la disposition" }).click();
  await page.getByRole("button", { name: `Format de ${title}` }).click();
  await page.getByRole("menuitemradio", { name: format }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByRole("toolbar", { name: "Disposition" })).toHaveCount(0);
}

async function fillField(dialog: Locator, index: number, label: string, value: string) {
  await dialog.getByRole("checkbox", { name: "Aucune valeur" }).nth(index).click();
  await dialog.getByRole("textbox", { name: label, exact: true }).fill(value);
}

const game = (page: Page): FrameLocator =>
  page.frameLocator('iframe[title="Jeu itch.io"]').first().frameLocator("iframe");
const story = (page: Page, name = "Screens / Home"): FrameLocator =>
  page.frameLocator(`iframe[title="${name}"]`).frameLocator("iframe");

function watchRelays(page: Page): string[] {
  const served: string[] = [];
  page.on("response", (res) => {
    if (new URL(res.url()).pathname.startsWith("/e/")) served.push(res.url());
  });
  return served;
}

test("jeu itch.io : intégration, plein écran, hors ligne, jeu refusé", async ({ page, baseURL }, info) => {
  const itch = local(fakeItchPort(portOf(baseURL)));
  const relays = watchRelays(page);
  const { repo } = await openProject(page, info, "JEU");
  const main = page.getByRole("main");
  try {
    await addComponent(page, "Jeu itch.io");
    await setFormat(page, "Jeu itch.io", /^Demi-page/);
    await expect(main.getByRole("status").filter({ hasText: "Colle le code d'intégration" })).toBeVisible();
    const settings = await openSettings(page, "Jeu itch.io");
    await fillField(settings, 0, "Jeu", GAME_CODE);
    await shot(page, info, "ecran-178d");
    await settings.getByRole("button", { name: "Enregistrer" }).click();
    await expect(settings).toBeHidden();

    await expect(main.getByText("Una war", { exact: true })).toBeVisible();
    await expect(main.getByText("Fourni par itch.io")).toBeVisible();
    const play = game(page).getByRole("button", { name: "Jouer" });
    await play.click();
    await play.click();
    await expect(game(page).getByText("Parties : 2")).toBeVisible();
    await shot(page, info, "ecran-178");

    const before = relays.length;
    await main.getByTitle("Plein écran").click();
    const focused = page.getByRole("dialog", { name: "Jeu itch.io" });
    await expect(focused).toBeVisible();
    expect((await focused.boundingBox())?.width).toBeGreaterThan(1400);
    await expect(game(page).getByText("Parties : 2")).toBeVisible();
    await shot(page, info, "ecran-179");
    await page.keyboard.press("Escape");
    await expect(focused).toBeHidden();
    await expect(game(page).getByText("Parties : 2")).toBeVisible();
    expect(relays.length).toBe(before);

    expect((await fetch(`${itch}/__test/offline`, { method: "POST" })).ok).toBe(true);
    await page.context().setOffline(true);
    const offline = main.getByRole("alert").filter({ hasText: "Ce jeu a besoin d'Internet." });
    await expect(offline).toBeVisible();
    await offline.getByRole("button", { name: "Réessayer" }).click();
    await expect(offline).toBeVisible();
    await shot(page, info, "ecran-178b");
    expect((await fetch(`${itch}/__test/online`, { method: "POST" })).ok).toBe(true);
    await page.context().setOffline(false);
    await expect(game(page).getByText("Parties : 2")).toBeVisible();

    await addComponent(page, "Jeu itch.io");
    const second = await openSettings(page, "Jeu itch.io");
    await fillField(second, 0, "Jeu", REFUSED_GAME);
    await fillField(second, 1, "Page du jeu", "https://sigmatronic.itch.io/una-war");
    await second.getByRole("button", { name: "Enregistrer" }).click();
    const refused = main.getByRole("alert").filter({ hasText: "itch.io n'autorise pas l'intégration" });
    await expect(refused).toBeVisible();
    await expect(refused.getByRole("link", { name: "Ouvrir sur itch.io" })).toHaveAttribute(
      "href",
      "https://sigmatronic.itch.io/una-war",
    );
    await refused.scrollIntoViewIfNeeded();
    await shot(page, info, "ecran-178c");
  } finally {
    repo.remove();
  }
});

async function connectPenpot(page: Page, instance: string) {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Paramètres" })
    .getByRole("link", { name: "Intégrations" })
    .click();
  const row = page.getByRole("listitem").filter({ has: page.getByText("Penpot", { exact: true }) });
  await row.getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter Penpot" });
  await dialog.getByLabel("Adresse de l'instance").fill(instance);
  await dialog.getByLabel("Jeton d'accès").fill(E2E_PENPOT_TOKEN);
  await dialog.getByRole("button", { name: "Connecter", exact: true }).click();
  await expect(dialog).toBeHidden();
}

async function declareStorybook(page: Page, info: TestInfo, project: string, origin: string) {
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: project, exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const edit = page.getByRole("dialog", { name: "Modifier le projet" });
  const fields = edit.getByRole("group", { name: "Storybook" });
  await fields.getByLabel("Adresse").fill(origin);
  await fields.getByLabel("Variable du port dans .env des worktrees").fill("STORYBOOK_PORT");
  await shot(page, info, "ecran-182");
  await edit.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(edit).toBeHidden();
}

async function showFrames(page: Page, urls: string[]) {
  const settings = await openSettings(page, "Maquette");
  const list = settings.getByRole("group", { name: "Cadres" });
  for (const [i, url] of urls.entries()) {
    await list.getByRole("button", { name: "Ajouter un cadre" }).click();
    await list.getByRole("textbox", { name: `Cadre ${i + 1}` }).fill(url);
  }
  await settings.getByRole("button", { name: "Enregistrer" }).click();
  await expect(settings).toBeHidden();
}

test("story Storybook : cadre interactif, worktree, comparaison, injoignable", async ({
  page,
  baseURL,
}, info) => {
  const base = portOf(baseURL);
  const storybook = local(fakeStorybookPort(base));
  const branchPort = fakeBranchStorybookPort(base);
  const penpot = local(fakePenpotPort(base));
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await connectPenpot(page, penpot);
  const { repo, name } = await openProject(page, info, "SBK");
  const main = page.getByRole("main");
  try {
    await declareStorybook(page, info, name, storybook);
    await addComponent(page, "Maquette");
    await setFormat(page, "Maquette", /^Plein écran/);
    await showFrames(page, [`${storybook}/?path=/story/${STORY}`, penpotBoardUrl(penpot, PENPOT_IDS)]);
    await expect(main.getByText("Storybook", { exact: true })).toBeVisible();
    await expect(main.getByRole("link", { name: "Ouvrir dans Storybook" })).toBeVisible();
    await story(page).getByRole("button", { name: "Cliquer" }).click();
    await expect(story(page).getByText("Clics : 1")).toBeVisible();
    await shot(page, info, "ecran-180");

    const worktree = join(repo.repo, "..", "feat-x");
    repo.git("worktree", "add", "-q", "-b", "feat/x", worktree);
    writeFileSync(join(worktree, ".env"), `STORYBOOK_PORT=${branchPort}\n`);
    await main.getByRole("button", { name: "Actualiser" }).click();
    const origins = main.getByRole("button", { name: "Storybook : Projet" });
    await origins.click();
    await expect(page.getByRole("menuitemradio", { name: /feat\/x/ })).toBeVisible();
    await shot(page, info, "ecran-180c");
    await page.getByRole("menuitemradio", { name: /feat\/x/ }).click();
    await expect(main.getByRole("button", { name: "Storybook : feat/x" })).toBeVisible();
    await expect(story(page).getByText("Clics : 0")).toBeVisible();

    await main.getByRole("button", { name: "Comparer" }).click();
    await expect(main.getByRole("img", { name: "Accueil" })).toBeVisible();
    await expect(story(page).getByRole("button", { name: "Cliquer" })).toBeVisible();
    await shot(page, info, "ecran-181");
    await main.getByRole("radio", { name: "Superposition" }).click();
    await main.getByRole("slider", { name: "Maquette" }).fill("30");
    await main.getByRole("slider", { name: "Curseur de comparaison" }).fill("40");
    const overlay = main.getByRole("img", { name: "Accueil" }).locator("..");
    await expect(overlay).toHaveCSS("opacity", "0.3");
    await expect(overlay).toHaveCSS("clip-path", "inset(0px 60% 0px 0px)");
    await expect(overlay).toHaveCSS("pointer-events", "none");
    await shot(page, info, "ecran-181b");
    await main.getByRole("button", { name: "Fermer la comparaison" }).click();

    expect((await fetch(`${local(branchPort)}/__test/offline`, { method: "POST" })).ok).toBe(true);
    await main.getByRole("button", { name: "Actualiser" }).click();
    await expect(main.getByText(`Storybook injoignable (127.0.0.1:${branchPort})`)).toBeVisible();
    await shot(page, info, "ecran-180b");
    expect((await fetch(`${local(branchPort)}/__test/online`, { method: "POST" })).ok).toBe(true);
  } finally {
    repo.remove();
  }
});
