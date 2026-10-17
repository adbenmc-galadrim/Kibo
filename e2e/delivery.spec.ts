import { expect, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import {
  type DeliveryRun,
  deliverFromBoard,
  type Emis,
  holdSlots,
  openBoard,
  openEmis,
  openProjectSettings,
  openQuestions,
  release,
  runCount,
  runFor,
  settled,
  subagentStates,
  ticketPath,
} from "./delivery-kit";
import { capture } from "./visibility-kit";

test.setTimeout(180_000);
test.describe.configure({ mode: "serial" });

let e: Emis;
let page: Page;
const held: DeliveryRun[] = [];

test.beforeAll(async ({ browser }, info) => {
  e = await openEmis(browser, info);
  page = e.page;
});

test.afterAll(async () => {
  for (const run of held) release(e, run);
  await page?.context().close();
  e?.repo.remove();
});

const agentsBar = () => page.getByRole("region", { name: "Agents" });
const shoot = (screen: string) => capture(page, test.info(), screen);

test("211 · trois refus deviennent une question, « Autoriser et relancer » relance le run", async () => {
  await openBoard(e);
  await deliverFromBoard(e, "EMIS-16");
  await runFor(e, "EMIS-16");
  await settled(e, "EMIS-16", 1);
  await openQuestions(e);
  const card = page.getByRole("article", { name: "3 actions refusées pendant le run" });
  const proposals = card.getByRole("region", { name: "Propositions de Kibo" });
  await expect(proposals.getByText("2 sur 3 autorisables")).toBeVisible();
  await expect(proposals.getByRole("checkbox", { name: "Règle Bash(pnpm *)" })).toBeChecked();
  await expect(proposals.getByText("commande shell : à autoriser à la main")).toBeVisible();
  await card.scrollIntoViewIfNeeded();
  await shoot("211");

  await proposals.getByRole("button", { name: "Autoriser et relancer" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Autoriser et relancer ?" });
  await expect(confirm.getByRole("list", { name: "Règle ajoutée à l'agent (1)" })).toHaveText("Bash(pnpm *)");
  await expect(confirm.getByText(/^Non repris :/)).toContainText('sh -c "rm -rf x"');
  await shoot("211b");
  await confirm.getByRole("button", { name: "Autoriser et relancer" }).click();
  await expect(confirm).toBeHidden();
  await settled(e, "EMIS-16", 2);
});

test("210 · le préréglage Livraison règle la fiche de full-delivery", async () => {
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "Ouvrir l'agent full-delivery" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "full-delivery" })).toBeVisible();
  await page.getByRole("button", { name: "Préréglage : Livraison" }).click();
  const dialog = page.getByRole("dialog", { name: "Appliquer le préréglage Livraison ?" });
  await expect(dialog.getByText("aucun → Tous les sous-agents")).toBeVisible();
  await expect(dialog.getByRole("region", { name: /^Règles ajoutées/ })).toContainText("Bash(kibo *)");
  await shoot("210b");
  await dialog.getByRole("button", { name: "Appliquer le préréglage" }).click();
  await expect(dialog).toBeHidden();
  const settings = page.getByRole("button", { name: /^Réglages techniques/ });
  await settings.click();
  const mode = page.getByRole("radio", { name: "Automatique (l'agent décide, sans contournement)" });
  await expect(mode).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Dossiers supplémentaires" })).toHaveValue(
    "~/.claude/skills",
  );
  await expect(
    page.getByRole("button", { name: "Sous-agents appelables tous les sous-agents" }),
  ).toBeVisible();
  await settings.evaluate((el) => el.scrollIntoView({ block: "start" }));
  await shoot("210");
});

test("215 · « Modifier le projet » importe les réglages du registre full-delivery", async () => {
  await page.goto(`/#/p/${e.projectId}/${e.board}`);
  await openProjectSettings(e);
  const settings = page.getByRole("dialog", { name: "Modifier le projet" });
  const delivery = settings.getByRole("group", { name: "Livraison" });
  await delivery.getByRole("button", { name: "Importer depuis full-delivery" }).click();
  const importer = page.getByRole("dialog", { name: "Importer depuis full-delivery" });
  await expect(importer.getByText("correspond à ce projet")).toBeVisible();
  await expect(importer.getByRole("row", { name: /^Base des worktrees main origin\/main/ })).toBeVisible();
  await expect(importer.getByRole("row", { name: /^Règles aucune 2 règles/ })).toBeVisible();
  await shoot("215b");
  await importer.getByRole("button", { name: "Importer" }).click();
  await expect(importer).toBeHidden();
  await expect(delivery.getByRole("textbox", { name: "Dossier de travail du skill" })).toHaveValue(
    "~/delivery/emis",
  );
  await expect(delivery.getByRole("combobox", { name: "Publication" })).toHaveText("Brouillon (draft)");
  await delivery.scrollIntoViewIfNeeded();
  await shoot("215");
  const recipe = settings.getByRole("group", { name: "Recette" });
  await expect(recipe.getByRole("textbox", { name: "Commandes après" })).toHaveValue("git status --short");
  await recipe.scrollIntoViewIfNeeded();
  await shoot("215c");
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  const project = await rpc(page, { method: "getProject", projectId: e.projectId });
  expect(JSON.stringify(project)).toContain('"baseRef":"origin/main"');
});

test("213 · 212 · « Livrer » EMIS-15 : étapes, captures à valider, livré", async () => {
  await openBoard(e);
  await deliverFromBoard(e, "EMIS-15");
  await runFor(e, "EMIS-15");
  const card = page.getByRole("article", { name: /^EMIS-15 / });
  await expect(card.getByText("7 · Porte qualité")).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Actions EMIS-18" }).click();
  await expect(page.getByRole("menuitem", { name: "Livrer" })).toBeEnabled();
  await shoot("213");
  await page.keyboard.press("Escape");

  await page.goto(ticketPath(e, "EMIS-15"));
  await expect(page.getByText("Livraison : 7/11 · Porte qualité", { exact: false })).toBeVisible();
  await shoot("213b");

  await openQuestions(e);
  const question = page.getByRole("article", { name: "Valider l'écran 1.2 ?" });
  await expect(question.getByRole("list", { name: "Captures · 2" })).toBeVisible();
  await shoot("212");
  await question.getByRole("button", { name: "Agrandir 1-no-access.png" }).click();
  const viewer = page.getByRole("dialog", { name: "1-no-access.png" });
  await expect(viewer.getByText("1 / 2")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.getByRole("dialog", { name: "2-no-access-mobile.png" }).getByText("2 / 2")).toBeVisible();
  await shoot("212c");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await question.getByRole("button", { name: "Demander une correction" }).click();
  const form = question.getByRole("form", { name: "Demander une correction : Valider l'écran 1.2 ?" });
  await form
    .getByRole("textbox", { name: "Ta correction" })
    .fill("Le bouton doit ramener à la liste des cours.");
  await expect(form.getByRole("button", { name: "Envoyer la correction" })).toBeEnabled();
  await shoot("212b");
  await form.getByRole("button", { name: "Annuler" }).click();
  await question.getByRole("button", { name: "Valider", exact: true }).click();
  await settled(e, "EMIS-15", 2);
  await page.goto(ticketPath(e, "EMIS-15"));
  await expect(page.getByText("Livraison : 11/11 · Livré", { exact: false })).toBeVisible();
});

test("214 · 216 à 219 · les sous-tickets de EMIS-17 et leurs sous-agents", async () => {
  await openBoard(e);
  await expect(page.getByRole("article", { name: /Comptes clients \(C2\)/ })).toHaveCount(0);
  await page
    .getByRole("article", { name: /^EMIS-18 / })
    .getByRole("button", { name: /^Ouvrir l'ensemble F1 · Comptes clients \(C2\)$/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Actions EMIS-17" }).click();
  await page.getByRole("menuitem", { name: "Livrer les sous-tickets" }).click();
  const dialog = page.getByRole("dialog", { name: "Livrer les sous-tickets de EMIS-17" });
  await expect(dialog.getByRole("checkbox", { name: "EMIS-18 C2-1 · Liste des comptes" })).toBeChecked();
  await expect(dialog.getByRole("checkbox", { name: "EMIS-19 C2-2 · Fiche d'un compte" })).toBeChecked();
  await expect(dialog.getByText("bloqué par EMIS-19")).toBeVisible();
  await shoot("214");
  await dialog.getByRole("button", { name: "Livrer 2 tickets" }).click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const list = await runFor(e, "EMIS-18");
  const review = await runFor(e, "EMIS-19");
  held.push(list, review);
  await expect
    .poll(() => subagentStates(e, review.id), { timeout: 45_000 })
    .toEqual([
      "Repérage du code:done",
      "Porte qualité — conventions:failed",
      "Porte qualité — correctness:running",
    ]);
  await expect
    .poll(() => subagentStates(e, list.id), { timeout: 45_000 })
    .toContain("Porte qualité — correctness:running");

  holdSlots(e);
  await page.goto("/#/agents");
  await page.getByRole("button", { name: "Files d'attente" }).click();
  const locks = page.getByRole("region", { name: "Verrous de la machine" });
  await expect(locks.getByText("emis:EMIS-19 gates")).toBeVisible({ timeout: 15_000 });
  await locks.scrollIntoViewIfNeeded();
  await shoot("216");

  await page.goto(`/#/runs/${review.id}`);
  await expect(page.getByText("3 sous-agents · 1 en cours")).toBeVisible();
  const section = page.getByRole("region", { name: "Sous-agents" });
  await expect(section.getByText("Porte qualité — correctness")).toBeVisible();
  await shoot("219");

  const feed = page.getByRole("region", { name: "Fil narratif" });
  await expect(feed.getByRole("button", { name: /Porte qualité — conventions · échec$/ })).toBeVisible();
  await feed
    .getByRole("button", { name: /^Sous-agent ecc:code-reviewer · Porte qualité — correctness · en cours/ })
    .click();
  await expect(feed.getByRole("button", { name: "Voir le prompt" })).toBeVisible();
  await expect(feed.getByRole("region", { name: "Actions du sous-agent ecc:code-reviewer" })).toContainText(
    "A lancé 2 commandes",
  );
  await shoot("217");

  await expect(
    agentsBar().getByRole("button", {
      name: /^Voir le sous-agent ecc:code-reviewer · Porte qualité — correctness/,
    }),
  ).toHaveCount(2);
  await page.goto(ticketPath(e, "EMIS-19"));
  await expect(page.getByRole("heading", { name: "C2-2 · Fiche d'un compte" })).toBeVisible();
  await shoot("218");

  for (const run of held.splice(0)) release(e, run);
  await settled(e, "EMIS-19", 1);
  await settled(e, "EMIS-18", 1);
  await page.goto(`/#/runs/${review.id}`);
  await expect(page.getByText("3 sous-agents", { exact: true })).toBeVisible();
  await expect(feed.getByRole("button", { name: /Porte qualité — correctness · terminé en/ })).toBeVisible();
  await expect(feed.getByText("Résumé : RAS")).toBeVisible();
  await feed.getByText("Résumé : RAS").scrollIntoViewIfNeeded();
  await shoot("217b");
});

test("un ensemble n'est jamais lancé : sa fiche ne propose que ses sous-tickets, l'API refuse", async () => {
  const before = await runCount(e);
  await openBoard(e);
  await page
    .getByRole("article", { name: /^EMIS-18 / })
    .getByRole("button", { name: /^Ouvrir l'ensemble F1 · Comptes clients \(C2\)$/ })
    .click();
  const sheet = page.getByRole("dialog");
  await expect(sheet).toContainText("Fonctionnalité · F1 · EMIS-17");
  await expect(page.getByRole("button", { name: "Assigner à un agent" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "Actions EMIS-17" }).click();
  await page.getByRole("menuitem", { name: "Livrer les sous-tickets" }).click();
  const dialog = page.getByRole("dialog", { name: "Livrer les sous-tickets de EMIS-17" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const assign = {
    method: "assignAgent",
    projectId: e.projectId,
    ticketId: e.tickets.get("EMIS-17"),
    profileId: e.reviewer,
    brief: "relis",
  };
  await expect(rpc(page, assign)).rejects.toThrow("TICKET_HAS_CHILDREN");
  expect(await runCount(e)).toBe(before);
});
