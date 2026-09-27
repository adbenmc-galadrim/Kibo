import { type Browser, expect, type Page, type TestInfo, test } from "@playwright/test";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { readSyncState, SYNC_PORTS } from "./sync-fixture";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });

async function waitForDaemon(port: number) {
  await expect
    .poll(async () => (await fetch(`http://127.0.0.1:${port}/`).catch(() => null))?.status ?? 0, {
      timeout: 30_000,
    })
    .toBe(200);
}

async function openAs(browser: Browser, port: number, colorScheme: "dark" | "light"): Promise<Page> {
  await waitForDaemon(port);
  const context = await browser.newContext({ baseURL: `http://127.0.0.1:${port}`, colorScheme });
  return context.newPage();
}

async function pair(page: Page) {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Nouveau projet" }).first()).toBeVisible();
}

async function connect(page: Page, code: string, device: string) {
  const { caFile, serverUrl } = readSyncState();
  await page.goto("/#/settings/sync");
  await page.getByRole("button", { name: "Se connecter à un serveur" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Adresse du serveur").fill(serverUrl);
  await dialog.getByLabel("Code d'invitation").fill(code);
  await dialog.getByLabel("Nom de cet appareil").fill(device);
  await dialog.getByLabel("Certificat racine (optionnel)").fill(caFile);
  await dialog.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByText("Connecté")).toBeVisible();
}

function presentIn(page: Page, name: string) {
  return page
    .getByRole("main")
    .getByRole("list", { name: "Personnes présentes" })
    .getByRole("img", { name, exact: true });
}

test("deux utilisateurs voient les mêmes tickets en temps réel", async ({ browser }, info: TestInfo) => {
  test.setTimeout(180_000);
  const theme = info.project.name === "sync-light" ? "light" : "dark";
  const ports = SYNC_PORTS[theme];
  const { codes } = readSyncState();
  const key = theme === "light" ? "SYL" : "SYD";
  const adam = await openAs(browser, ports.a, theme);
  const lea = await openAs(browser, ports.b, theme);

  await pairAndCreateProject(adam, info, key);
  await pair(lea);
  await connect(adam, theme === "light" ? codes.lightA : codes.darkA, "MacBook d'Adam");
  await connect(lea, theme === "light" ? codes.lightB : codes.darkB, "MacBook de Léa");

  await adam.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await createPage(adam, "Kanban", "Vue");
  await addComponent(adam, "Kanban");
  await adam.getByRole("button", { name: "Tous", exact: true }).click();

  await adam.getByRole("main").getByRole("button", { name: "Partager", exact: true }).click();
  const share = adam.getByRole("dialog");
  await expect(share.getByRole("list", { name: "Reste sur ta machine" })).toContainText("Dossier local");
  await share.getByRole("button", { name: "Partager" }).click();
  await expect(share.getByRole("list", { name: "Membres" })).toContainText("Adam");
  await share.getByRole("button", { name: "Générer un code" }).click();
  const code = (await share.locator(".font-mono").first().textContent())?.trim() ?? "";
  expect(code).toMatch(/^([A-Z2-7]{4} ){6}[A-Z2-7]{2}$/);
  await adam.keyboard.press("Escape");
  await expect(adam.getByText("Démon local · synchronisé")).toBeVisible();

  await lea.getByRole("button", { name: "Rejoindre un projet" }).click();
  await lea.getByLabel("Code d'invitation").fill(code);
  await lea.getByRole("button", { name: "Rejoindre" }).click();
  await lea.getByRole("button", { name: "Kanban", exact: true }).click();
  await expect(lea.getByRole("region", { name: "À faire" })).toBeVisible();
  await lea.getByRole("button", { name: "Tous", exact: true }).click();

  await expect(presentIn(adam, "Léa")).toBeVisible({ timeout: 5_000 });
  await expect(presentIn(lea, "Adam")).toBeVisible({ timeout: 5_000 });

  await adam.getByRole("button", { name: "Nouveau ticket dans À faire" }).click();
  await adam.getByLabel("Titre").fill("Visible chez Léa");
  await adam.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(lea.getByText("Visible chez Léa")).toBeVisible({ timeout: 1_000 });
  await expect(adam.getByText(`${key}-1`)).toBeVisible();
  await expect(lea.getByText(`${key}-1`)).toBeVisible();

  await fetch(`http://127.0.0.1:${SYNC_PORTS.control}/stop`, { method: "POST" });
  await expect(adam.getByText("Démon local · hors ligne")).toBeVisible({ timeout: 10_000 });
  await adam.getByRole("button", { name: "Nouveau ticket dans À faire" }).click();
  await adam.getByLabel("Titre").fill("Créé hors ligne");
  await adam.getByRole("button", { name: "Créer le ticket" }).click();
  const pending = adam.getByText(`${key}-…`);
  await expect(pending).toBeVisible();
  await expect(pending).toHaveCSS("font-style", "italic");
  await expect(pending).toHaveAttribute("title", "Clé attribuée à la prochaine synchronisation");

  await fetch(`http://127.0.0.1:${SYNC_PORTS.control}/start`, { method: "POST" });
  await expect(adam.getByText(`${key}-2`)).toBeVisible({ timeout: 70_000 });
  await expect(adam.getByText(`${key}-…`)).toHaveCount(0);
  await expect(lea.getByText("Créé hors ligne")).toBeVisible({ timeout: 70_000 });
  await expect(lea.getByText(`${key}-2`)).toBeVisible();

  await adam.context().close();
  await lea.context().close();
});
