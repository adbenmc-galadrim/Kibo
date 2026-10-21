import { expect, test } from "@playwright/test";
import {
  attenteCli,
  createStepUnder,
  heldSection,
  listedKeys,
  onHoldOf,
  openAttente,
  openAttentePage,
  openTicketByKey,
} from "./attente-kit";
import { SILO_HOLD_SINCE } from "./fixtures/silo-attente";
import { SILO_PROJECT } from "./fixtures/silo-maquettes";
import { kiboCli, type Silo } from "./planning-kit";

test.describe.configure({ mode: "serial" });

const MINIO = "Serveur MinIO de recette indisponible";
const CONTRACTS = "Accès à la base contrats";

let silo: Silo;

test.beforeEach(async ({ page }) => {
  silo = await openAttente(page);
});

test("the on-hold scenario is seeded", async ({ page }, info) => {
  expect(attenteCli(info, ["tickets", "get", "SILO-45"])).toMatchObject({
    key: "SILO-45",
    onHold: { source: "own", since: SILO_HOLD_SINCE },
  });
  expect(await onHoldOf(page, silo, "SILO-34")).toMatchObject({ source: "dependency", key: "SILO-33" });
});

test("the Graphe shows the held steps in cyan and keeps F4 half-folded", async ({ page }) => {
  await openAttentePage(page, "Graphe");
  const f4 = page.getByRole("article", { name: /^F4 / });
  await expect(f4.getByRole("listitem")).toHaveCount(1);
  await expect(f4.getByRole("img", { name: "1 en attente" })).toBeVisible();
  await expect.poll(() => f4.locator('[data-tone="hold"]').count()).toBeGreaterThanOrEqual(2);
  const f5 = page.getByRole("article", { name: /^F5 / });
  await expect(f5.getByRole("img", { name: "En attente de SILO-33" })).toHaveCount(2);
  await expect(f5.getByRole("img", { name: `En attente : ${MINIO}` })).toBeVisible();
});

test("SILO-82 resumes from its banner, and the activity says « Reprise »", async ({ page }) => {
  const main = await openTicketByKey(page, silo, "SILO-82");
  const banner = main.getByRole("status", { name: "Étape en attente" });
  await expect(banner).toContainText(`En attente · ${MINIO} · depuis le 16 oct.`);
  await banner.getByRole("button", { name: "Reprendre" }).click();
  await expect(banner).toBeHidden();
  await main.getByRole("tab", { name: "Activité" }).click();
  await expect(main.getByText("Reprise", { exact: true }).first()).toBeVisible();
  expect(await onHoldOf(page, silo, "SILO-82")).toBeNull();
});

test("SILO-82 goes back on hold from the « ⋯ » menu with a suggested reason", async ({ page }) => {
  const main = await openTicketByKey(page, silo, "SILO-82");
  await main.getByRole("button", { name: "Actions SILO-82" }).click();
  await page.getByRole("menuitem", { name: "Mettre en attente…" }).click();
  const dialog = page.getByRole("dialog", { name: "Mettre SILO-82 en attente" });
  await dialog.getByRole("button", { name: MINIO, exact: true }).click();
  await expect(dialog.getByRole("textbox")).toHaveValue(MINIO);
  await dialog.getByRole("button", { name: "Mettre en attente", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(main.getByRole("status", { name: "Étape en attente" })).toContainText(`En attente · ${MINIO}`);
  await main.getByRole("tab", { name: "Activité" }).click();
  await expect(main.getByText(`Mise en attente · ${MINIO}`).first()).toBeVisible();
  expect(await onHoldOf(page, silo, "SILO-82")).toMatchObject({ source: "own", reason: MINIO });
});

test("the CLI shows the holds and leaves them out of the ready steps", async ({ page }, info) => {
  expect(kiboCli(info, ["tickets", "get", "SILO-34"])).toContain("En attente de SILO-33");
  const ready = listedKeys(info, ["--sprint", "current", "--ready"]);
  expect(ready).not.toContain("SILO-34");
  expect(ready).not.toContain("SILO-33");
  expect(kiboCli(info, ["tickets", "list", "--project", SILO_PROJECT.key])).toContain("⏸");
  expect(await onHoldOf(page, silo, "SILO-33")).toMatchObject({ source: "own", reason: MINIO });
});

test("a hold set from the CLI adds a group to the Planning, hold=off takes it away", async ({
  page,
}, info) => {
  await openAttentePage(page, "Planning");
  await expect(heldSection(page, 3)).toBeVisible();
  kiboCli(info, ["tickets", "set", "SILO-72", `hold=${CONTRACTS}`]);
  const four = heldSection(page, 4);
  await expect(four).toBeVisible();
  await expect(four.getByRole("group", { name: CONTRACTS })).toContainText("SILO-72");
  kiboCli(info, ["tickets", "set", "SILO-72", "hold=off"]);
  await expect(heldSection(page, 3)).toBeVisible();
  await expect(page.getByRole("group", { name: CONTRACTS })).toHaveCount(0);
});

test("a step of F2, whose sprint is over, resumes in S43 and takes F2 there", async ({ page }, info) => {
  const key = await createStepUnder(page, silo, "F2", "Export des affectations");
  kiboCli(info, ["tickets", "set", key, `hold=${CONTRACTS}`]);
  await openAttentePage(page, "Planning");
  const held = heldSection(page, 4);
  await expect(held).toBeVisible();
  await held.getByRole("button", { name: `Actions de ${key}` }).click();
  await page.getByRole("menuitem", { name: "Reprendre dans" }).click();
  await page.getByRole("menuitem", { name: "S43 · Import et contrats" }).click();
  await expect(heldSection(page, 3)).toBeVisible();
  await expect(
    page.getByRole("region", { name: /^S43 / }).getByRole("button", { name: /^F2 / }),
  ).toBeVisible();
  expect(await onHoldOf(page, silo, key)).toBeNull();
});

test("the Kanban keeps only the steps on hold, and « Démarrable » leaves SILO-34 out", async ({ page }) => {
  await openAttentePage(page, "Kanban");
  const cards = page.getByRole("article");
  const card = (keyLabel: string) => cards.filter({ has: page.getByText(keyLabel, { exact: true }) });
  await expect(cards.filter({ hasText: "Écran d'envoi hors ligne" })).toHaveCount(1);
  const held = page.getByRole("button", { name: /^En attente/ });
  await held.click();
  await expect(held).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(5);
  for (const keyLabel of ["SILO-45", "SILO-33", "SILO-82", "SILO-34", "SILO-35"])
    await expect(card(keyLabel)).toHaveCount(1);
  await held.click();
  const startable = page.getByRole("button", { name: /^Démarrable/ });
  await startable.click();
  await expect(startable).toHaveAttribute("aria-pressed", "true");
  await expect(card("SILO-34")).toHaveCount(0);
  await expect(card("SILO-33")).toHaveCount(0);
});

test("the Vue d'ensemble « 3 en attente » opens the Planning", async ({ page }) => {
  await openAttentePage(page, "Vue d'ensemble");
  await page.getByRole("button", { name: "3 en attente", exact: true }).click();
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
  await expect(heldSection(page, 3)).toBeVisible();
});
