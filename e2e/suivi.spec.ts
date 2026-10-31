import { expect, type Locator, type Page, test } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { clipboardText, kiboCli, type Silo } from "./planning-kit";
import { field, openProjectAgent, openSilo, openSiloPage, sprintFeatures } from "./suivi-kit";

test.describe.configure({ mode: "serial" });

let silo: Silo;

test.beforeEach(async ({ page }) => {
  silo = await openSilo(page);
});

const section = (page: Page, name: string) => page.getByRole("region", { name, exact: true });

const CROWDED = { name: "Centre chargé", key: "CHG", features: 16, questions: 12 };

async function seedCrowdedProject(page: Page): Promise<string> {
  const project = await rpc(page, {
    method: "createProject",
    name: CROWDED.name,
    key: CROWDED.key,
    folder: null,
    color: "#22C55E",
  });
  const projectId = text(project, "id");
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  for (const [title, component] of [
    ["Vue d'ensemble", "overview@1.0.0"],
    ["Questions", "questions@1.0.0"],
  ] as const) {
    const added = await command({ method: "addPage", title, kind: "view" });
    await command({ method: "addInstance", pageId: text(added, "id"), component });
  }
  const steps: string[] = [];
  for (let n = 1; n <= CROWDED.features; n += 1) {
    const root = await command({ method: "createTicket", title: `Fonctionnalité ${n}` });
    const step = await command({ method: "createTicket", title: `Étape ${n}`, parentId: text(root, "id") });
    steps.push(text(step, "id"));
  }
  for (let n = 1; n <= CROWDED.questions; n += 1)
    await command({
      method: "createQuestion",
      ticketId: steps[n % steps.length],
      title: `Question chargée ${n}`,
      blocking: n === CROWDED.questions,
      createdBy: { kind: "human", ref: "e2e" },
    });
  return projectId;
}

async function pageTitles(page: Page): Promise<string[]> {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  return list(snapshot, "pages")
    .filter((p) => field(p, "parentId") === null)
    .map((p) => text(p, "title"));
}

test("the Vue d'ensemble leads Silo and opens a feature, the sprint and a question", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  expect((await pageTitles(page))[0]).toBe("Vue d'ensemble");
  await openSiloPage(page, "Vue d'ensemble");
  await expect(page.getByText("2 sessions T3 Code")).toBeVisible();

  const next = section(page, "Prochaine à finir");
  await next.getByRole("button", { name: "Copier" }).click();
  expect(await clipboardText(page)).toBe("/full-delivery SILO-45");

  const activity = section(page, "Activité");
  await activity.getByRole("button", { name: "git", exact: true }).click();
  await expect(activity.getByRole("button", { name: "git", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const rows = activity.getByRole("listitem");
  await expect(rows.first()).toBeVisible();
  for (const label of await rows.allTextContents()) expect(label).toMatch(/PR #\d+|Branche/);
  await expect(activity.getByText(/Lot n° 7|Étape 7\/12/)).toHaveCount(0);

  await section(page, "Sprint S42 · Saisie hors ligne")
    .getByRole("button", { name: "Saisir un constat hors ligne" })
    .click();
  await expect(page.getByRole("dialog", { name: "Saisir un constat hors ligne" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Sprint S42 · Saisie hors ligne" }).click();
  const sheet = page.getByRole("dialog", { name: /S42 · Saisie hors ligne/ });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText("1 livrée sur 3")).toBeVisible();
  await page.keyboard.press("Escape");

  await section(page, "Questions").getByText("Un box réaffecté garde-t-il ses photos ?").click();
  await expect(page.getByRole("article", { name: "Un box réaffecté garde-t-il ses photos ?" })).toBeFocused();
});

test("the Graphe shows Silo in sprint columns, delivered features folded", async ({ page }) => {
  await openSiloPage(page, "Graphe");
  const lanes = page.getByRole("region", { name: "Fonctionnalités par sprint" });
  await expect(lanes).toBeVisible();
  for (const lane of ["S41 Accès", "S42 Saisie hors ligne", "S43 Import et contrats", "S44 Rapports"])
    await expect(lanes.getByRole("group", { name: lane })).toBeVisible();
  await expect(lanes.getByRole("group", { name: "À planifier" })).toBeVisible();
  const f5 = lanes.getByRole("article", { name: /^F5 / });
  await expect(f5).toBeVisible();
  await expect(f5).not.toHaveAttribute("data-late", "true");
  await expect(f5).not.toContainText("glisse en S43");

  const f1 = lanes.getByRole("article", { name: /^F1 / });
  await expect(f1).toBeVisible();
  await expect(f1.getByText("Application Azure")).toHaveCount(0);
  for (const name of ["Livrées repliées", "Options", "Colonnes : Sprints", "Regrouper : Fonctionnalités"])
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  await expect(page.getByRole("radiogroup", { name: "Vue" }).getByRole("radio")).toHaveText([
    "Fonctionnalités",
    "PRs",
  ]);
});

test("the Planning switches to Bandes and back to Colonnes", async ({ page }) => {
  await openSiloPage(page, "Planning");
  const layout = page.getByRole("group", { name: "Disposition" });
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
  await layout.getByRole("button", { name: "Bandes" }).click();
  await expect(layout.getByRole("button", { name: "Bandes" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Frise des fonctionnalités par sprint" })).toBeVisible();
  await expect(page.getByText("Glisse en Colonnes pour planifier")).toBeVisible();
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeHidden();
  await layout.getByRole("button", { name: "Colonnes" }).click();
  await expect(page.getByRole("region", { name: "S42 Saisie hors ligne" })).toBeVisible();
});

async function openSiloKanbanAll(page: Page): Promise<void> {
  await openSiloPage(page, "Kanban");
  const all = page.getByRole("main").getByRole("button", { name: "Tous", exact: true });
  if ((await all.getAttribute("aria-pressed")) !== "true") await all.click();
  await expect(all).toHaveAttribute("aria-pressed", "true");
}

const kanbanCard = (page: Page, keyLabel: string): Locator =>
  page.getByRole("article", { name: new RegExp(`^${keyLabel} `) });

test("the Kanban shows review, CI and sessions, and a CLI session lights SILO-51 without moving it", async ({
  page,
}, info) => {
  await openSiloKanbanAll(page);
  const pr20 = kanbanCard(page, "SILO-45");
  await expect(pr20).toContainText("#20");
  await expect(pr20.getByRole("note", { name: "changements demandés" })).toBeVisible();
  await expect(pr20.getByLabel("CI cassée")).toHaveCount(0);
  await expect(kanbanCard(page, "SILO-33").getByLabel("Session T3 Code en cours")).toBeVisible();

  const silo51 = page.getByRole("region", { name: "Bloqué" }).getByRole("article", { name: /^SILO-51 / });
  await expect(silo51).toBeVisible();
  await expect(silo51.getByLabel(/^Session .* en cours$/)).toHaveCount(0);
  kiboCli(info, ["tickets", "session", "SILO-51", "start"]);
  await expect(silo51.getByLabel("Session T3 Code en cours")).toBeVisible();
  kiboCli(info, ["tickets", "session", "SILO-51", "stop"]);
  await expect(silo51.getByLabel(/^Session .* en cours$/)).toHaveCount(0);
  await expect(silo51).toBeVisible();
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "keyLabel") === "SILO-51");
  expect(text(ticket, "statusId")).toBe("todo");
});

test("a retouche posed by the CLI shows on the delivered SILO-21 card with its update command", async ({
  page,
}, info) => {
  expect(kiboCli(info, ["tickets", "step", "SILO-21", "7", "--update"])).toContain(
    "retouche · Étape 7/12 · Porte qualité",
  );
  await openSiloKanbanAll(page);
  const silo21 = kanbanCard(page, "SILO-21");
  await expect(silo21).toContainText("retouche · Étape 7/12");
  await silo21.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "Copier /update-delivery SILO-21" })).toBeVisible();
});

test("the sprint sheet carries the report of F5 to S43, and the batch turns partial", async ({
  page,
}, info) => {
  await openSiloPage(page, "Vue d'ensemble");
  await expect(page.locator("[data-pending]")).toHaveText("3");
  await page.getByRole("button", { name: "Sprint S42 · Saisie hors ligne" }).click();
  const sheet = page.getByRole("dialog", { name: /S42 · Saisie hors ligne/ });
  const banner = sheet.getByRole("region", { name: "Proposition de l'agent de projet" });
  await expect(banner).toContainText("Fin de sprint : reporter F5 en S43 ?");
  await banner.getByRole("button", { name: "Valider" }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => sprintFeatures(info, "S43")).toContain("SILO-30");
  await page.keyboard.press("Escape");

  await openSiloPage(page, "Planning");
  const columns = page.getByRole("group", { name: "Disposition" }).getByRole("button", { name: "Colonnes" });
  if ((await columns.getAttribute("aria-pressed")) !== "true") await columns.click();
  await expect(
    page.getByRole("region", { name: "S43 Import et contrats" }).getByRole("button", { name: /^F5 / }),
  ).toBeVisible();

  await expect(page.locator("[data-pending]")).toHaveText("2");
});

test("after the sprint sheet, the agent panel still offers the rest of the batch", async ({ page }) => {
  await openSiloPage(page, "Vue d'ensemble");
  await expect(page.locator("[data-pending]")).toHaveText("2");
  const panel = await openProjectAgent(page);
  const batch = panel.getByRole("region", { name: "Lot n° 7" });
  await expect(batch).toBeVisible();
  await expect(batch.getByRole("listitem").filter({ hasText: "Reporter F5" })).toContainText("Appliquée");
  await expect(batch.getByRole("checkbox")).toHaveCount(2);
  await expect(batch.getByRole("checkbox", { name: /Planifier F9/ })).toBeVisible();
  await expect(batch.getByRole("checkbox", { name: /Relancer le client sur Q14/ })).toBeVisible();
  await expect(batch.getByRole("checkbox", { name: /Reporter F5/ })).toHaveCount(0);
  await expect(batch.getByRole("button", { name: "Valider (2)" })).toBeEnabled();
});

test("the agent panel applies the checked actions only, and Q14 is reminded", async ({ page }) => {
  await openSiloPage(page, "Vue d'ensemble");
  const panel = await openProjectAgent(page);
  const batch = panel.getByRole("region", { name: "Lot n° 7" });
  await expect(batch).toBeVisible();
  await batch.getByRole("checkbox", { name: /Planifier F9 en S44/ }).click();
  await batch.getByRole("button", { name: "Valider (1)" }).click();
  await expect(section(page, "Activité").getByText("Q14 relancée")).toBeVisible();
  await openSiloPage(page, "Questions");
  await page.getByText("Un box réaffecté garde-t-il ses photos ?").first().click();
  await expect(page.getByText(/relancée ·/)).toBeVisible();
});

test("a crowded Vue d'ensemble pages its questions and keeps the feature cells in their box", async ({
  page,
}, info) => {
  const projectId = await seedCrowdedProject(page);
  const snapshot = await rpc(page, { method: "getProject", projectId });
  const overview = list(snapshot, "pages").find((p) => field(p, "title") === "Vue d'ensemble");
  await page.goto(`/#/p/${encodeURIComponent(projectId)}/${encodeURIComponent(text(overview, "id"))}`);

  const indicators = section(page, "Indicateurs du projet");
  await expect(indicators.locator("[data-cell]")).toHaveCount(CROWDED.features);
  const questions = section(page, "Questions");
  await expect(questions.getByRole("listitem").first()).toBeVisible();
  await page.screenshot({ path: info.outputPath("vue-ensemble-chargee.png"), animations: "disabled" });

  const featureBox = indicators.locator("div").filter({ hasText: "Fonctionnalités" }).first();
  const frame = await featureBox.boundingBox();
  if (frame === null) throw new Error("the Fonctionnalités box is not on screen");
  const right = frame.x + frame.width;
  for (const cell of await indicators.locator("[data-cell]").all()) {
    const box = await cell.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThanOrEqual(4);
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(right);
  }

  await expect(questions.getByRole("listitem")).toHaveCount(5);
  await expect(questions.getByRole("listitem").first()).toContainText("bloquante");
  await questions.getByRole("button", { name: "Afficher plus (7)" }).click();
  await expect(questions.getByRole("listitem")).toHaveCount(10);
  await page.screenshot({ path: info.outputPath("vue-ensemble-plus.png"), animations: "disabled" });
  await questions.getByRole("button", { name: "Toutes les questions (12)" }).click();
  await expect(page.getByRole("article", { name: "Question chargée 1", exact: true })).toBeVisible();
});
