import { expect, type Locator, type Page, test } from "@playwright/test";
import { PENPOT_IDS, penpotBoardUrl } from "../packages/daemon/src/testing/penpot-ids";
import { rpc, text } from "./agents-seed";
import { addComponent, createPage, createSidebarPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";
import { E2E_FIGMA_TOKEN, E2E_PENPOT_TOKEN, fakePenpotPort } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

const FIGMA_URL = "https://www.figma.com/design/AbC123xyz/Kibo?node-id=12-34";
const TICKET = "Écran d'accueil";
const SECRETS = [E2E_FIGMA_TOKEN, E2E_PENPOT_TOKEN];

const penpotOf = (baseURL: string | undefined) =>
  `http://127.0.0.1:${fakePenpotPort(Number(new URL(baseURL ?? "").port))}`;

const row = (page: Page, title: string) =>
  page.getByRole("listitem").filter({ has: page.getByText(title, { exact: true }) });

async function openIntegrations(page: Page) {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Paramètres" })
    .getByRole("link", { name: "Intégrations" })
    .click();
  await expect(page.getByRole("heading", { name: "Intégrations" })).toBeVisible();
}

async function expectNoSecretOnScreen(page: Page) {
  const shown = await page.locator("body").innerText();
  for (const secret of SECRETS) expect(shown).not.toContain(secret);
}

function watchLeaks(page: Page): string[] {
  const leaked: string[] = [];
  const check = (where: string, body: string) => {
    if (SECRETS.some((s) => body.includes(s))) leaked.push(where);
  };
  page.on("response", async (res) => {
    if (!res.url().includes("/api/")) return;
    check(res.url(), await res.text().catch((e: unknown) => `unreadable: ${String(e)}`));
  });
  page.on("websocket", (ws) => ws.on("framereceived", ({ payload }) => check(ws.url(), String(payload))));
  return leaked;
}

function watchFrames(page: Page): number[] {
  const served: number[] = [];
  page.on("response", (res) => {
    if (new URL(res.url()).pathname.startsWith("/d/")) served.push(res.status());
  });
  return served;
}

async function connectFigma(page: Page, info: Parameters<typeof shot>[1]) {
  await row(page, "Figma").getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter Figma" });
  await dialog.getByRole("textbox", { name: "Jeton", exact: true }).fill(E2E_FIGMA_TOKEN);
  await shot(page, info, "ecran-53");
  await dialog.getByRole("button", { name: "Connecter", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, "Figma")).toContainText("adam");
}

async function connectPenpot(page: Page, info: Parameters<typeof shot>[1], instance: string) {
  await row(page, "Penpot").getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter Penpot" });
  await dialog.getByLabel("Adresse de l'instance").fill(instance);
  await dialog.getByLabel("Jeton d'accès").fill(E2E_PENPOT_TOKEN);
  await shot(page, info, "ecran-147");
  await dialog.getByRole("button", { name: "Connecter", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, "Penpot")).toContainText("Adam");
}

async function penpotIgnoresTokens(page: Page, info: Parameters<typeof shot>[1], instance: string) {
  expect((await fetch(`${instance}/__test/ignore-tokens`, { method: "POST" })).ok).toBe(true);
  await row(page, "Penpot").getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter Penpot" });
  await expect(dialog.getByRole("list", { name: "Comment faire" })).toContainText("enable-access-tokens");
  await expect(dialog.getByRole("link", { name: "Documentation Penpot" })).toHaveAttribute(
    "href",
    /help\.penpot\.app/,
  );
  await dialog.getByLabel("Adresse de l'instance").fill(instance);
  await dialog.getByLabel("Jeton d'accès").fill(E2E_PENPOT_TOKEN);
  await dialog.getByRole("button", { name: "Connecter", exact: true }).click();
  await expect(dialog.getByText("Penpot a ignoré ce jeton")).toBeVisible();
  await shot(page, info, "ecran-147e");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
  await expect(row(page, "Penpot").getByRole("button", { name: "Connecter" })).toBeVisible();
  expect((await fetch(`${instance}/__test/honor-tokens`, { method: "POST" })).ok).toBe(true);
}

async function configureFrames(page: Page, urls: string[], info?: Parameters<typeof shot>[1]) {
  await page.getByRole("main").getByRole("button", { name: "Actions Maquette" }).click();
  await page.getByRole("menuitem", { name: "Réglages…" }).click();
  const dialog = page.getByRole("dialog");
  const list = dialog.getByRole("group", { name: "Cadres" });
  const removes = list.getByRole("button", { name: /^Retirer le cadre/ });
  while ((await removes.count()) > 0) {
    const before = await removes.count();
    await removes.first().click();
    await expect(removes).toHaveCount(before - 1);
  }
  for (const [i, url] of urls.entries()) {
    await list.getByRole("button", { name: "Ajouter un cadre" }).click();
    await list.getByRole("textbox", { name: `Cadre ${i + 1}` }).fill(url);
  }
  if (info) await shot(page, info, urls.length > 1 ? "ecran-164c" : "ecran-149");
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();
}

async function browseFrames(page: Page, info: Parameters<typeof shot>[1], penpot: string) {
  const main = page.getByRole("main");
  await configureFrames(page, [FIGMA_URL, penpotBoardUrl(penpot, PENPOT_IDS)], info);
  await expectLoaded(main.getByRole("img", { name: "Tickets" }));
  await expect(main.getByText("1 / 2")).toBeVisible();
  await main.getByRole("button", { name: "Cadre suivant" }).click();
  await expectLoaded(main.getByRole("img", { name: "Accueil" }));
  await expect(main.getByText("2 / 2")).toBeVisible();
  await shot(page, info, "ecran-164");
  await main.getByRole("button", { name: "Zoom avant" }).click();
  await expect(main.getByText("125 %")).toBeVisible();
  const viewer = main.getByRole("group", { name: /^Aperçu de Accueil/ });
  await viewer.dblclick();
  await expect(main.getByText("100 %")).toBeVisible();
  await viewer.dblclick();
  await expect(main.getByText("200 %")).toBeVisible();
  await shot(page, info, "ecran-164b");
  await main.getByRole("button", { name: "Ajuster" }).click();
  await expect(main.getByText("100 %")).toBeVisible();
  await viewer.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(main.getByText("1 / 2")).toBeVisible();
  await expectLoaded(main.getByRole("img", { name: "Tickets" }));
  await configureFrames(page, [penpotBoardUrl(penpot, { ...PENPOT_IDS, board: PENPOT_IDS.bare })]);
  await expect(main.getByText(/^Pas encore d'aperçu/)).toBeVisible();
  await shot(page, info, "ecran-148d");
}

async function openTicket(page: Page, key: string): Promise<Locator> {
  await page.getByRole("radio", { name: "Tous", exact: true }).click();
  await page.getByRole("button", { name: TICKET, exact: true }).click();
  const sheet = page.getByRole("dialog").filter({ hasText: key });
  await expect(sheet.getByRole("heading", { name: "Maquettes" })).toBeVisible();
  return sheet;
}

async function projectIdOf(page: Page, name: string): Promise<string> {
  const projects = await rpc(page, { method: "listProjects" });
  if (!Array.isArray(projects)) throw new Error("projects not listed");
  const project: unknown = projects.find((p: unknown) => text(p, "name") === name);
  return text(project, "id");
}

async function openDashboard(page: Page) {
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Tableau de bord", exact: true })
    .click();
}

const frameItem = (sheet: Locator, name: string) =>
  sheet.getByRole("listitem").filter({ has: sheet.page().getByRole("img", { name, exact: true }) });

async function expectLoaded(img: Locator) {
  await expect(img).toBeVisible();
  await expect
    .poll(() => img.evaluate((el) => (el instanceof HTMLImageElement ? el.naturalWidth : 0)))
    .toBeGreaterThan(0);
}

test("maquettes Figma et Penpot : connexion, widget, fiche, hors ligne", async ({ page, baseURL }, info) => {
  const penpot = penpotOf(baseURL);
  const leaked = watchLeaks(page);
  const served = watchFrames(page);
  const key = projectKey("MAQ", info);
  await pairAndCreateProject(page, info, key);
  const projectId = await projectIdOf(page, `Kibo ${key}`);

  await openIntegrations(page);
  await connectFigma(page, info);
  await penpotIgnoresTokens(page, info, penpot);
  await connectPenpot(page, info, penpot);
  await expectNoSecretOnScreen(page);
  await shot(page, info, "ecran-16");

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Maquette");
  const main = page.getByRole("main");
  await expect(
    main.getByText("Colle l'URL d'un cadre Figma ou d'un board Penpot dans les réglages du widget."),
  ).toBeVisible();
  await shot(page, info, "ecran-148-vide");
  await configureFrames(page, [FIGMA_URL], info);
  await expectLoaded(main.getByRole("img", { name: "Tickets" }));
  await expect.poll(() => served.length).toBeGreaterThan(0);
  expect(served.every((s) => s === 200)).toBe(true);
  await expectNoSecretOnScreen(page);
  await shot(page, info, "ecran-148");
  await browseFrames(page, info, penpot);

  const ticket = await rpc(page, {
    method: "command",
    projectId,
    command: { method: "createTicket", title: TICKET, statusId: "todo" },
  });
  const ticketKey = text(ticket, "key");
  await createSidebarPage(page, `Kibo ${key}`, "Kanban", "Vue");
  await addComponent(page, "Kanban");
  const sheet = await openTicket(page, ticketKey);
  const link = async (url: string) => {
    await sheet.getByRole("textbox", { name: "Lier un cadre" }).fill(url);
    await sheet.getByRole("button", { name: "Lier un cadre" }).click();
  };
  await link(FIGMA_URL);
  await expectLoaded(sheet.getByRole("img", { name: "Tickets", exact: true }));
  await link(penpotBoardUrl(penpot, PENPOT_IDS));
  const board = frameItem(sheet, "Accueil");
  await expectLoaded(board.getByRole("img", { name: "Accueil" }));
  await expectNoSecretOnScreen(page);
  await shot(page, info, "ecran-4");

  expect((await fetch(`${penpot}/__test/offline`, { method: "POST" })).ok).toBe(true);
  await board.getByRole("button", { name: "Actualiser" }).click();
  await expect(board.getByText("Périmé")).toBeVisible();
  await expect(board.getByText("Hors ligne")).toBeVisible();
  await expect(board.getByRole("img", { name: "Accueil" })).toBeVisible();
  await shot(page, info, "ecran-4-hors-ligne");
  await page.keyboard.press("Escape");

  await openDashboard(page);
  await configureFrames(page, [penpotBoardUrl(penpot, PENPOT_IDS)]);
  await expect(main.getByRole("img", { name: "Accueil" })).toBeVisible();
  await expect(main.getByRole("region", { name: "Tickets liés" })).toContainText(TICKET);
  await main.getByRole("button", { name: "Actualiser" }).click();
  await expect(main.getByText("Périmé")).toBeVisible();
  await expect(main.getByText("Hors ligne")).toBeVisible();
  await shot(page, info, "ecran-148-hors-ligne");
  expect((await fetch(`${penpot}/__test/online`, { method: "POST" })).ok).toBe(true);

  await openIntegrations(page);
  await row(page, "Penpot").getByRole("button", { name: "Actions pour Penpot" }).click();
  await page.getByRole("menuitem", { name: "Déconnecter" }).click();
  const confirm = page.getByRole("dialog", { name: "Déconnecter Penpot ?" });
  await expect(confirm).toContainText("les aperçus en cache aussi");
  await confirm.getByRole("button", { name: "Déconnecter" }).click();
  await expect(row(page, "Penpot").getByRole("button", { name: "Connecter" })).toBeVisible();

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await openDashboard(page);
  await expect(main.getByRole("img", { name: "Accueil" })).toBeVisible();
  await main.getByRole("button", { name: "Actualiser" }).click();
  await expect(main.getByText("Hors ligne")).toBeVisible();
  await expect(main.getByRole("img", { name: "Accueil" })).toBeVisible();
  await expectNoSecretOnScreen(page);
  await shot(page, info, "ecran-148-deconnecte");
  expect(leaked).toEqual([]);
});
