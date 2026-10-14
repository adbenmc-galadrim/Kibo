import { expect, type Page, test } from "@playwright/test";
import {
  assign,
  autoLinkStates,
  type Boutique,
  finished,
  type HeldRun,
  ignoredKeys,
  KEEPER,
  OTHER,
  OWNER,
  openBoutique,
  openTotal,
  overlapStates,
  release,
  SHELL,
  sweepSettled,
  wrote,
} from "./overlaps-kit";
import { capture } from "./visibility-kit";

test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

let b: Boutique;
let page: Page;
let owner: HeldRun;

const OWNER_NAME = "bou · livraison · BOU-12";
const feed = () => page.getByRole("region", { name: "Fil narratif" });
const overlapLine = () => feed().locator("[data-overlap]");
const autoLinkLine = () => feed().locator("[data-auto-link]");
const EDGE = { x: 4, y: 4 };

test.beforeAll(async ({ browser }, info) => {
  b = await openBoutique(browser, info);
  page = b.page;
  owner = await assign(b, OWNER);
  await wrote(b, owner, 2);
});

test.afterAll(async () => {
  if (b && owner) {
    release(b, owner);
    await finished(b, owner);
  }
  await page?.context().close();
  b?.repo.remove();
});

test("BOU-16 écrit par le shell : le balayage trouve le recouvrement, la barre le compte, on l'ignore", async () => {
  const info = test.info();
  const shell = await assign(b, SHELL);
  await wrote(b, shell, 1);
  await page.goto(`/#/runs/${shell.id}`);
  const parallel = page.getByRole("region", { name: "Travail en parallèle" });
  const ownerCard = parallel.locator(`[data-run="${owner.id}"]`);
  await expect(ownerCard).toContainText("Format des dates de livraison");
  await expect(ownerCard).toContainText("formatDate");
  await parallel.scrollIntoViewIfNeeded();
  await capture(page, info, "200b");

  release(b, shell);
  await finished(b, shell);
  await expect
    .poll(() => overlapStates(b, shell.id), { timeout: 30_000 })
    .toEqual(["export:formatDate:open"]);
  await expect.poll(() => openTotal(b)).toBe(1);
  await page.goto(`/#/p/${b.projectId}/t/${b.tickets.get(OWNER)}`);
  await expect(page.getByRole("heading", { name: "Format des dates de livraison" })).toBeVisible();
  const bar = page.getByRole("button", { name: /^(Déplier|Replier) les agents$/ });
  const agents = page.getByRole("region", { name: "Agents" });
  await expect(agents.getByText("1/3 place", { exact: true })).toBeVisible();
  await expect(agents.getByText(/recouvrement/)).toHaveCount(0);
  await expect(page.getByRole("img", { name: /recouvrement/ })).toHaveCount(0);
  await capture(page, info, "200");
  await bar.click({ position: EDGE });
  const dockRuns = page.getByRole("region", { name: "Runs" });
  await expect(dockRuns.locator("button[aria-pressed]").first()).toBeVisible();
  await expect(dockRuns.getByText(/^Recouvrement avec/)).toHaveCount(0);
  await capture(page, info, "200-dock");
  await bar.click({ position: EDGE });

  await page.goto(`/#/runs/${shell.id}`);
  const open = overlapLine().filter({ hasText: `Recouvrement avec ${OWNER_NAME}` });
  await expect(open).toContainText("formatDate exporté deux fois");
  await expect(open).toContainText("information");
  await expect(open).toContainText("Ouvert");
  await open.scrollIntoViewIfNeeded();
  await capture(page, info, "197");

  await open.getByRole("button", { name: "Voir les fichiers" }).click();
  const files = page.getByRole("dialog", { name: "Fichiers du recouvrement" });
  await expect(files.getByText(`${OWNER_NAME} · src/lib/format.ts`)).toBeVisible();
  await expect(files.getByText("bou · livraison · BOU-16 · src/utils/date.ts")).toBeVisible();
  await capture(page, info, "197c");
  await files.getByRole("button", { name: "Fermer" }).click();
  await expect(files).toBeHidden();

  await open.getByRole("button", { name: "Ignorer" }).click();
  await expect(open).toContainText(/Ignoré par /);
  await expect.poll(() => overlapStates(b, shell.id)).toEqual(["export:formatDate:ignored"]);
  await expect.poll(() => openTotal(b)).toBe(0);
});

test("BOU-15 reprend le travail de BOU-12, Kibo lie les tickets puis le lien s'annule", async () => {
  const info = test.info();
  await page.goto(`/#/p/${b.projectId}/t/${b.tickets.get(OTHER)}`);
  await expect(page.getByRole("heading", { name: "Page de suivi de commande" })).toBeVisible();
  const other = await assign(b, OTHER);
  await finished(b, other);
  await expect.poll(() => autoLinkStates(b), { timeout: 30_000 }).toEqual(["copy:added"]);
  const badge = page.getByRole("button", { name: "Lien ajouté par Kibo avec BOU-12" });
  await expect(badge).toBeVisible({ timeout: 15_000 });
  await expect.poll(() => overlapStates(b, other.id)).toContain("export:DateStyle:resolved");
  await page.reload();
  await expect(badge).toBeVisible();
  await badge.click();
  await expect(page.getByText("Reprise de")).toBeVisible();
  await expect(page.getByRole("button", { name: "Annuler" })).toBeVisible();
  await capture(page, info, "199");
  await page.keyboard.press("Escape");

  await page.getByRole("tab", { name: "Activité" }).click();
  await expect(page.getByText(/^Recouvrements : \d+ réglés? · 0 ouvert$/)).toBeVisible();
  await capture(page, info, "199b");

  await page.goto(`/#/runs/${owner.id}`);
  const owned = overlapLine().filter({ hasText: "repris par bou · livraison · BOU-15" });
  await expect(owned.first()).toContainText(/Réglé \d{2}:\d{2}/);
  await capture(page, info, "197b");

  await page.goto(`/#/runs/${other.id}`);
  await expect(
    overlapLine()
      .filter({ hasText: `Recouvrement avec ${OWNER_NAME}` })
      .first(),
  ).toContainText(/Réglé \d{2}:\d{2}/);
  await expect(feed().getByText("Kibo a rappelé de factoriser")).toBeVisible();
  const linked = autoLinkLine().filter({ hasText: "Kibo a lié" });
  await expect(linked).toContainText("(BOU-12 bloque BOU-15)");
  await linked.scrollIntoViewIfNeeded();
  await capture(page, info, "198");
  await linked.getByRole("button", { name: "Annuler" }).click();
  await expect(linked).toContainText(/Annulé par .+ \d{2}:\d{2}/);
  await expect(linked).toContainText("Kibo ne le reposera pas");
  await capture(page, info, "198b");
  await expect.poll(() => autoLinkStates(b)).toEqual(["copy:cancelled"]);

  await page.goto(`/#/p/${b.projectId}/t/${b.tickets.get(OTHER)}`);
  await expect(page.getByRole("heading", { name: "Page de suivi de commande" })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { name: "Page de suivi de commande" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Lien ajouté par Kibo avec BOU-12" })).toHaveCount(0);
});

test("BOU-17 réécrit la copie ignorée : aucune alerte ni ligne", async () => {
  const keeper = await assign(b, KEEPER);
  await wrote(b, keeper, 1);
  await finished(b, keeper);
  await sweepSettled(b);
  await expect.poll(() => overlapStates(b, keeper.id)).toEqual([]);
  await page.goto(`/#/runs/${keeper.id}`);
  await expect(feed().getByText("Date de suivi livrée.")).toBeVisible();
  await expect(overlapLine()).toHaveCount(0);
  await expect(feed().getByText("Kibo a rappelé de factoriser")).toHaveCount(0);
});

test("les réglages du projet réactivent le recouvrement ignoré", async () => {
  const info = test.info();
  await page
    .locator('[data-sidebar="sidebar"]')
    .getByRole("button", { name: "Boutique", exact: true })
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "Modifier…" }).click();
  const dialog = page.getByRole("dialog", { name: "Modifier le projet" });
  const group = dialog.getByRole("group", { name: "Doublons entre agents" });
  await expect(group.getByRole("switch", { name: "Détecter les doublons entre agents" })).toBeChecked();
  await expect(group.getByText("Exports génériques")).toBeVisible();
  const reactivate = group.getByRole("button", { name: /^Réactiver .*formatDate/ });
  await expect(reactivate).toBeVisible();
  await reactivate.evaluate((el) => el.scrollIntoView({ block: "center" }));
  await capture(page, info, "201");
  await reactivate.click();
  await expect(group.getByText("Aucun", { exact: true })).toBeVisible();
  await expect.poll(() => ignoredKeys(b)).toEqual([]);
  await page.keyboard.press("Escape");
});

test("« Ce que reçoit l'agent » montre la section Travail en cours sur le projet", async () => {
  const info = test.info();
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "Ouvrir l'agent livraison" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "livraison" })).toBeVisible();
  await page.getByRole("button", { name: "Ce que reçoit l'agent" }).click();
  const preview = page.getByRole("dialog", { name: /Ce que reçoit l'agent/ });
  const work = preview.getByText("Travail en cours sur le projet", { exact: false }).first();
  await expect(work).toBeVisible();
  await work.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await capture(page, info, "201b");
  await page.keyboard.press("Escape");
});
