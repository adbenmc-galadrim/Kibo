import { rmSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import {
  assign,
  createAgent,
  createGitRepo,
  list,
  pairBrowser,
  rpc,
  runState,
  type Seeded,
  seedWorkspace,
  text,
} from "./agents-seed";

test.setTimeout(180_000);
test.use({ viewport: { width: 1440, height: 900 } });
test.describe.configure({ mode: "serial" });

let seeded: Seeded | null = null;

let repo: string | null = null;
test.afterAll(async () => {
  const dir = repo;
  repo = null;
  if (dir) await expect(() => rmSync(dir, { recursive: true, force: true })).toPass();
});

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const DELIVERY = "Livre un ticket en TDD avec des commits propres";

async function maxParallelOf(page: Page, name: string): Promise<unknown> {
  const listed = list(await rpc(page, { method: "agents.list" }), "agents");
  const agent = listed.find((a) => prop(a, "name") === name);
  return prop(prop(agent, "settings"), "maxParallel");
}

async function createDeliveryAgent(page: Page, info: TestInfo) {
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page.getByRole("button", { name: "Nouvel agent" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvel agent" });
  await dialog.getByLabel("Nom", { exact: true }).fill("livraison");
  await expect(dialog.getByRole("radio", { name: "Global" })).toHaveAttribute("data-state", "on");
  await dialog.getByLabel("Description").fill(DELIVERY);
  await dialog.getByLabel("Modèle").click();
  await page.getByRole("option", { name: "Opus" }).click();
  await dialog.getByText("Livraison", { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /^Livraison/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Créer l'agent" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByRole("article", { name: "livraison" });
  await expect(card).toBeVisible();

  await card.getByRole("button", { name: "Ouvrir l'agent livraison" }).click();
  const settings = page.getByRole("button", { name: /^Réglages techniques/ });
  await expect(settings).toHaveAttribute("aria-expanded", "false");
  await settings.click();
  await expect(settings).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("radio", { name: "Modifications acceptées" }).click();
  await page.getByLabel("Runs en parallèle").fill("2");
  await expect.poll(() => maxParallelOf(page, "livraison")).toBe(2);
  await shot(page, info, "ecran-28");
  await page.locator('[data-sidebar="sidebar"]').getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("article", { name: "livraison" })).toBeVisible();
}

const projectFilter = (page: Page) => page.getByRole("button", { name: "Filtrer par projet" });

const projectHeader = (page: Page) => page.locator('[data-slot="table-head"]', { hasText: /^Projet$/ });

const queueNumbers = (page: Page) =>
  page
    .locator("[data-queued='true']")
    .evaluateAll((items) => items.map((item) => /#\d+/.exec(item.textContent ?? "")?.[0] ?? "").sort());

async function pickProject(page: Page, name: string) {
  await projectFilter(page).click();
  await page.getByRole("menuitemradio", { name, exact: true }).click();
}

async function filterByProject(page: Page, info: TestInfo) {
  const kibRow = page
    .getByRole("row")
    .filter({ hasText: /KIB-\d+/ })
    .first();
  await expect(projectFilter(page)).toHaveText(/Projet : tous/);
  await expect(projectHeader(page)).toBeVisible();
  await expect(kibRow).toContainText("Kibo");
  await pickProject(page, "Kibo");
  await expect(projectFilter(page)).toHaveText("Projet : Kibo");
  await expect(projectHeader(page)).toHaveCount(0);
  await expect(kibRow).toBeVisible();
  await page.reload();
  await expect(projectFilter(page)).toHaveText("Projet : Kibo");
  await shot(page, info, "agents-filtre-projet");

  await page.getByRole("button", { name: "Files d'attente" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Files d'attente" })).toBeVisible();
  await expect(projectFilter(page)).toHaveText("Projet : Kibo");
  await expect(page.getByText(/toute la machine/)).toBeVisible();
  await expect(page.getByRole("region", { name: "Capacité de la machine" })).toBeVisible();
  await expect(page.locator("[data-queued='true']").first()).toBeVisible();
  const underKibo = await queueNumbers(page);
  expect(underKibo.length).toBeGreaterThan(0);
  await shot(page, info, "files-filtre-projet");
  await pickProject(page, "API Facturation");
  await expect(page.locator("[data-queued='true']")).toHaveCount(0);
  await pickProject(page, "Tous les projets");
  await expect(page.getByText(/toute la machine/)).toHaveCount(0);
  await expect(page.locator("[data-queued='true']")).toHaveCount(underKibo.length);
  expect(await queueNumbers(page)).toEqual(underKibo);
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await expect(projectFilter(page)).toHaveText(/Projet : tous/);
}

test("agents au travail : cartes, file, journal, réponse, review", async ({ page }, info) => {
  await pairBrowser(page);
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  await createDeliveryAgent(page, info);

  repo = createGitRepo();
  seeded = await seedWorkspace(page, repo);
  await assign(page, seeded, 12, "livraison", "running");
  await assign(page, seeded, 14, "livraison", "waiting_input");
  const rules = await assign(page, seeded, 16, "livraison", "running");
  await assign(page, seeded, 7, "review-plan", "running");
  const watcher = await assign(page, seeded, 10, "livraison", "queued");
  await assign(page, seeded, 18, "livraison", "queued");
  await assign(page, seeded, 29, "livraison", "queued");
  await rpc(page, { method: "setRunPriority", runId: watcher, priority: true });

  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  const doing = page.getByRole("region", { name: "En cours" });
  await expect(doing.getByText("· Attend")).toBeVisible();
  await expect(page.getByRole("region", { name: "À faire" }).getByText("· En file #3")).toBeVisible();

  await page
    .getByRole("region", { name: "À faire" })
    .getByRole("button", { name: /^Kanban : drag/ })
    .click();
  await page.getByRole("dialog").getByRole("button", { name: "Assigner à un agent" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("Assigner KIB-15 à un agent")).toBeVisible();
  await dialog.getByRole("combobox", { name: "Agent" }).click();
  await page.getByRole("option", { name: /^livraison ·/ }).click();
  await dialog
    .getByLabel("Brief (optionnel)")
    .fill("Implémenter le drag & drop avec @dnd-kit ; garder l'ordre dans le LoroTree.");
  await expect(dialog.getByText(/KIB-15 attend KIB-12 \(en cours\)/)).toBeVisible();
  await expect(dialog.getByText("nouveau worktree kib-15 (depuis main)")).toBeVisible();
  await expect(dialog.getByText(/entrera en file/)).toBeVisible();
  await shot(page, info, "ecran-27");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Répondre à global · livraison · KIB-14" }).click();
  const journal = page.getByRole("list", { name: "Fil de global · livraison · KIB-14" });
  await expect(journal.getByText("Quel port pour le récepteur ?")).toBeVisible();
  await expect(page.getByText("worktree kib-14")).toBeVisible();
  await shot(page, info, "ecran-5");
  await page.getByRole("button", { name: "Replier les agents" }).click();

  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await page.getByRole("button", { name: "Files d'attente" }).click();
  const capacity = page.getByRole("region", { name: "Capacité de la machine" });
  await expect(capacity.getByText(/seuil 85 %/)).toBeVisible();
  await expect(capacity.getByText(/seuil 90 %/)).toBeVisible();
  await expect(capacity.getByText(/Places sur la machine : 3 \(fixé · auto : \d+\)/)).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "En attente de réponse" })
      .getByRole("button", { name: "global · livraison · KIB-14", exact: true }),
  ).toBeVisible();
  await shot(page, info, "ecran-17");

  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Historique des runs" })).toBeVisible();
  await shot(page, info, "ecran-13");

  await page.getByRole("button", { name: "Paramètres" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Général" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Paramètres" })
    .getByRole("link", { name: "Domaines & guidelines" })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: "Domaines & guidelines" })).toBeVisible();
  await page.getByRole("button", { name: "Core", exact: true }).click();
  await expect(page.getByText("skills/loro-patterns.md")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Éditer" })).toHaveAttribute("aria-selected", "true");
  await shot(page, info, "ecran-14");
  const trigger = page.getByRole("combobox", { name: "Projet" });
  const width = (await trigger.boundingBox())?.width ?? 0;
  info.annotations.push({ type: "chevron-width", description: String(width) });
  await shot(page, info, "ecran-14-chevron");
  expect(width).toBeGreaterThanOrEqual(24);
  await trigger.click({ timeout: 5_000 });
  await expect(page.getByRole("option")).toHaveCount(3);

  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await page.getByRole("button", { name: "Répondre à global · livraison · KIB-14" }).click();
  await page
    .getByLabel("Réponse à global · livraison · KIB-14")
    .fill("Port dynamique, écrit dans ~/.kibo/daemon.json");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await rpc(page, { method: "cancelRun", runId: rules });
  await expect.poll(() => runState(page, "KIB-14"), { timeout: 45_000 }).toBe("done");
  await expect(doing.getByRole("article").filter({ hasText: "KIB-14" })).toBeVisible();
  await page.getByRole("button", { name: "Passer en review" }).click();
  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByText("KIB-14")).toBeVisible();
  await expect(
    review.getByRole("article").filter({ hasText: "KIB-14" }).getByText("livraison"),
  ).toBeVisible();
});

test("l'historique ouvre le run cliqué, pour trois agents différents", async ({ page }, info) => {
  if (!seeded) throw new Error("seed missing");
  await pairBrowser(page);
  await assign(page, seeded, 9, "tests-rapides", "queued");
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Filtrer par état" })
    .getByRole("radio", { name: "Tous" })
    .click();
  await filterByProject(page, info);
  for (const [agent, key, title] of [
    ["review-plan", "KIB-7", "Tokens shadcn + thème sombre"],
    ["tests-rapides", "KIB-9", "Setup Tauri + sidecar Bun"],
    ["livraison", "KIB-12", "Schéma Loro des tickets (LoroTree)"],
  ] as const) {
    const label = `global · ${agent} · ${key}`;
    await page
      .getByRole("row", { name: new RegExp(`^${key} · `) })
      .getByRole("cell")
      .nth(2)
      .click();
    const panel = page.getByRole("dialog", { name: `Run ${label}`, exact: true });
    await expect(panel.getByRole("list", { name: `Fil de ${label}` })).toBeAttached();
    await expect(panel.getByRole("heading", { name: label, exact: true })).toBeVisible();
    await expect(panel.getByRole("button", { name: title, exact: true })).toBeVisible();
  }
  await shot(page, info, "historique-trois-agents");
});

type AskedQuestion = { id: string; title: string; deliveredRunId: string | null };

async function askedQuestions(page: Page, projectId: string, ticketId: string): Promise<AskedQuestion[]> {
  const snapshot = await rpc(page, { method: "getProject", projectId });
  const ofTicket = list(snapshot, "questions").filter((q) => prop(q, "ticketId") === ticketId);
  return ofTicket.map((q) => {
    const delivered = prop(prop(q, "answer"), "deliveredRunId");
    return {
      id: text(q, "id"),
      title: text(q, "title"),
      deliveredRunId: typeof delivered === "string" ? delivered : null,
    };
  });
}

async function runProgress(page: Page, runId: string): Promise<string> {
  const current = list(await rpc(page, { method: "getAgents" }), "runs").find((r) => prop(r, "id") === runId);
  return `${String(prop(current, "state"))}:${String(prop(current, "turns"))}`;
}

test("un run pose une question à valider, la réponse attend « Transmettre à l'agent »", async ({
  page,
}, info) => {
  if (!seeded) throw new Error("seed missing");
  const { projectId } = seeded;
  const ticketId = seeded.tickets.get(22) ?? "";
  await pairBrowser(page);
  await rpc(page, { method: "setHost", patch: { hostSlots: 12 } });
  const agent = await createAgent(page, {
    name: "emis-livraison",
    description: "Livre un ticket d'Emis et pose ses questions avant de trancher",
    model: "opus",
    settings: { permissionMode: "acceptEdits", workspace: "isolated", maxParallel: 1 },
  });
  const run = await rpc(page, {
    method: "assignAgent",
    projectId,
    ticketId,
    profileId: agent,
    brief: "Toute décision non tranchée passe par ask_question.",
  });
  const runId = text(run, "id");
  await expect.poll(() => runState(page, "KIB-22"), { timeout: 30_000 }).toBe("done");
  const [question] = await askedQuestions(page, projectId, ticketId);
  expect(question?.title).toBe("Bloquer le dépôt sur une affaire archivée ?");

  await page.goto("/#/agents");
  await page
    .getByRole("radiogroup", { name: "Filtrer par état" })
    .getByRole("radio", { name: "Tous" })
    .click();
  const row = page.getByRole("row", { name: /^KIB-22 · / });
  await expect(row).toContainText("Terminé · 1 question");
  await row.getByRole("cell").nth(2).click();
  const panel = page.getByRole("dialog", { name: "Run global · emis-livraison · KIB-22", exact: true });
  await expect(panel.getByRole("list", { name: "Fil de global · emis-livraison · KIB-22" })).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  const expand = page.getByRole("button", { name: "Déplier les agents" });
  if ((await expand.count()) > 0) {
    const label = await expand.locator("xpath=..").getByText("Agents", { exact: true }).boundingBox();
    if (!label) throw new Error("bar label not laid out");
    await page.mouse.click(label.x + label.width / 2, label.y + label.height / 2);
  }
  await expect(page.getByRole("button", { name: "Replier les agents" })).toBeVisible();
  const drawer = page.getByRole("region", { name: "Agents" });
  await drawer
    .getByRole("list", { name: /^Terminés depuis 24 h · \d+$/ })
    .getByRole("button", { name: /KIB-22/ })
    .click();
  await expect(drawer.getByText("1 question ouverte")).toBeVisible();
  await expect(drawer.getByRole("list", { name: /^Terminés depuis 24 h · \d+$/ })).toContainText(
    /KIB-22 · .+ · 1 question/,
  );
  await shot(page, info, "ecran-172");

  await rpc(page, {
    method: "command",
    projectId,
    command: {
      method: "answerQuestion",
      questionId: question?.id,
      answer: { kind: "confirm" },
      by: { kind: "human", ref: "e2e" },
    },
  });
  await expect(drawer.getByText("1 réponse à transmettre")).toBeVisible();
  await expect(drawer.getByText("1 question ouverte")).toHaveCount(0);
  expect(await runProgress(page, runId)).toBe("done:1");
  await shot(page, info, "ecran-172-transmettre");

  await drawer.getByRole("button", { name: "Transmettre à l'agent" }).click();
  await expect.poll(() => runProgress(page, runId), { timeout: 30_000 }).toBe("done:2");
  await expect(drawer.getByText("1 réponse à transmettre")).toHaveCount(0);
  await expect(drawer.getByRole("list", { name: "Fil de global · emis-livraison · KIB-22" })).toContainText(
    "reprise de la session",
  );
  expect((await askedQuestions(page, projectId, ticketId))[0]?.deliveredRunId).toBe(runId);
  await shot(page, info, "ecran-172-transmis");
});
