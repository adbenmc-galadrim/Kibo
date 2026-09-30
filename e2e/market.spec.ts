import { readFileSync } from "node:fs";
import { type APIRequestContext, expect, type Page, type TestInfo, test } from "@playwright/test";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { MARKET_PORTS, MARKET_REVOKE_REASON, MARKET_STATE_FILE, type MarketE2eState } from "./market-fixture";

type Theme = keyof MarketE2eState;

const themeOf = (info: TestInfo): Theme => (info.project.name === "market-light" ? "light" : "dark");

function stateOf(theme: Theme) {
  const all = JSON.parse(readFileSync(MARKET_STATE_FILE, "utf8")) as MarketE2eState;
  return all[theme];
}

const firstLine = (hex: string) => (hex.slice(0, 32).match(/.{4}/g) ?? []).join(" ");

async function control(request: APIRequestContext, theme: Theme, action: string): Promise<number> {
  const res = await request.post(`http://127.0.0.1:${MARKET_PORTS.control}/${theme}/${action}`);
  expect(res.ok()).toBe(true);
  return Number(await res.text());
}

async function waitForDaemon(request: APIRequestContext, theme: Theme) {
  await expect
    .poll(async () => {
      const res = await request.get(`http://127.0.0.1:${MARKET_PORTS[theme]}/`).catch(() => null);
      return res?.ok() ?? false;
    })
    .toBe(true);
}

async function openSources(page: Page) {
  await page.getByRole("button", { name: "Paramètres" }).click();
  await page.getByRole("link", { name: "Composants" }).click();
  await expect(page.getByRole("heading", { name: "Sources" })).toBeVisible();
}

async function refreshSource(page: Page, serial: number) {
  await openSources(page);
  await page.getByRole("button", { name: "Actions Équipe" }).click();
  await page.getByRole("menuitem", { name: "Rafraîchir" }).click();
  const source = page
    .getByRole("row")
    .filter({ has: page.getByRole("cell", { name: "Équipe", exact: true }) });
  await expect(source.getByRole("cell", { name: String(serial), exact: true })).toBeVisible();
}

async function openInstalled(page: Page) {
  await page.getByRole("button", { name: "Composants", exact: true }).click();
  await page.getByRole("tab", { name: "Installés" }).click();
}

async function approveSandboxed(page: Page, subtitle: string) {
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(subtitle)).toBeVisible();
  await expect(dialog.getByText("Ce code vient d'une marketplace.")).toBeVisible();
  await dialog.getByRole("radio", { name: /Sandboxé/ }).click();
  await dialog.getByRole("button", { name: "Autoriser" }).click();
  await expect(dialog).toBeHidden();
}

test.use({ actionTimeout: 15_000 });

test("marketplace : source, installation vérifiée, mises à jour, clé changée, révocation", async ({
  page,
  request,
}, info) => {
  test.setTimeout(240_000);
  const theme = themeOf(info);
  const key = theme === "light" ? "MKL" : "MKD";
  const verified = "Publié par Léa · vérifié par Équipe";
  await waitForDaemon(request, theme);
  const { market, fingerprint } = stateOf(theme);
  await pairAndCreateProject(page, info, key);

  await test.step("ajout de la source en deux étapes", async () => {
    await openSources(page);
    await page.getByRole("button", { name: "Ajouter une source" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Adresse").fill(market);
    await dialog.getByRole("button", { name: "Suivant" }).click();
    await expect(dialog.getByText(firstLine(fingerprint))).toBeVisible();
    await dialog.getByRole("button", { name: "Ajouter", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("cell", { name: "Équipe", exact: true })).toBeVisible();
  });

  await test.step("recherche, détail, code vérifié et installation", async () => {
    await page.getByRole("button", { name: "Composants", exact: true }).click();
    await page.getByRole("tab", { name: "Marketplace" }).click();
    await page.getByLabel("Rechercher un composant").fill("burn");
    await page.getByRole("button", { name: "Voir Burndown" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Léa · vérifié par Équipe")).toBeVisible();
    await expect(sheet.getByText("Nouvel éditeur")).toBeVisible();
    await expect(sheet.getByText("Code vérifié : signature et empreinte correspondent")).toBeVisible();
    await sheet.getByRole("button", { name: "Voir le code" }).click();
    await sheet.getByRole("button", { name: "ui.tsx" }).click();
    await expect(sheet.getByText(/export function Component/)).toBeVisible();
    await sheet.getByRole("button", { name: "Installer 0.1.0" }).click();
    await approveSandboxed(page, verified);
  });

  await test.step("empreinte altérée : paquet refusé, rien d'installé", async () => {
    await page.getByLabel("Rechercher un composant").fill("vélo");
    await page.getByRole("button", { name: "Voir Vélocité" }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("alert")).toHaveText("L'empreinte ne correspond pas.");
    await expect(sheet.getByRole("button", { name: "Installer 0.1.0" })).toBeDisabled();
    await expect(sheet.getByRole("button", { name: "Voir le code" })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });

  const row = (version: string) =>
    page
      .getByRole("row", { name: /Burndown/ })
      .filter({ has: page.getByRole("cell", { name: new RegExp(`^${version.replaceAll(".", "\\.")}\\b`) }) });
  const frame = page.frameLocator("iframe[sandbox='allow-scripts']");

  await test.step("ajout à une page", async () => {
    await openInstalled(page);
    await expect(row("0.1.0").getByText("Marketplace · Équipe")).toBeVisible();
    await expect(page.getByRole("row", { name: /Vélocité/ })).toHaveCount(0);
    await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
    await createPage(page, "Suivi", "Tableau de bord");
    await addComponent(page, "Burndown");
    await expect(frame.getByText("Burndown")).toBeVisible();
  });

  await test.step("mise à jour partout via l'écran 6", async () => {
    await refreshSource(page, await control(request, theme, "publish-next"));
    await openInstalled(page);
    await expect(row("0.1.0").getByText("0.2.0 disponible")).toBeVisible();
    await row("0.1.0").getByRole("button", { name: "Mettre à jour" }).click();
    const update = page.getByRole("dialog", { name: "Mettre à jour « Burndown » 0.1.0 → 0.2.0" });
    await expect(update.getByText("Ligne idéale")).toBeVisible();
    await expect(update.getByRole("radio", { name: "Mettre à jour partout" })).toBeChecked();
    await update.getByRole("button", { name: "Mettre à jour", exact: true }).click();
    await approveSandboxed(page, verified);
    await expect(row("0.2.0").getByText("1 page · 1 projet")).toBeVisible();
    await expect(row("0.1.0").getByText("Aucune page")).toBeVisible();
    await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
    await page.getByRole("button", { name: "Suivi", exact: true }).click();
    await expect(frame.getByText("Burndown")).toBeVisible();
    await expect(page.getByText(/Composant (absent|introuvable)/)).toHaveCount(0);
  });

  await test.step("clé d'éditeur changée : refus puis déblocage", async () => {
    await refreshSource(page, await control(request, theme, "publish-rekeyed"));
    await openInstalled(page);
    await expect(row("0.2.0").getByText("0.3.0 disponible")).toBeVisible();
    await row("0.2.0").getByRole("button", { name: "Mettre à jour" }).click();
    const changed = page.getByRole("dialog", { name: "La clé de l'éditeur a changé" });
    await expect(changed.getByText("Ancienne clé")).toBeVisible();
    await expect(changed.getByText("Nouvelle clé")).toBeVisible();
    await changed.getByRole("button", { name: "Débloquer", exact: true }).click();
    await expect(changed).toBeHidden();
    await row("0.2.0").getByRole("button", { name: "Mettre à jour" }).click();
    const update = page.getByRole("dialog", { name: "Mettre à jour « Burndown » 0.2.0 → 0.3.0" });
    await expect(update.getByText("Nouvelle clé d'éditeur")).toBeVisible();
    await update.getByRole("button", { name: "Mettre à jour", exact: true }).click();
    await approveSandboxed(page, verified);
    await expect(row("0.3.0").getByText("1 page · 1 projet")).toBeVisible();
  });

  await test.step("révocation : version désactivée avec son motif", async () => {
    await refreshSource(page, await control(request, theme, "revoke-rekeyed"));
    await openInstalled(page);
    await expect(row("0.3.0").getByText("Révoqué", { exact: true })).toBeVisible();
    await expect(row("0.3.0").getByText("Autorisation requise")).toBeVisible();
    await expect(row("0.3.0").getByText(`Révoqué : ${MARKET_REVOKE_REASON}`)).toBeVisible();
    await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
    await page.getByRole("button", { name: "Suivi", exact: true }).click();
    await expect(page.getByText(`Révoqué : ${MARKET_REVOKE_REASON}`)).toBeVisible();
    await expect(frame.getByText("Burndown")).toHaveCount(0);
  });
});
