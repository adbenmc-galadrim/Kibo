import { rmSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { assign, createGitRepo, list, rpc, runState, type Seeded, seedWorkspace, text } from "./agents-seed";
import { E2E_TOKEN } from "./token";

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

async function createOpusProfile(page: Page, info: TestInfo) {
  await page.getByRole("button", { name: "Agents", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page.getByRole("button", { name: "Nouveau profil" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Nom").fill("opus-dev");
  await sheet.getByText("Modifications acceptées").click();
  await sheet.getByLabel("Runs en parallèle (profil)").fill("2");
  await sheet.getByRole("button", { name: "Sonnet", exact: true }).click();
  await sheet.getByRole("button", { name: "Haiku", exact: true }).click();
  await shot(page, info, "ecran-28");
  await sheet.getByRole("button", { name: "Créer le profil" }).click();
  await expect(page.getByRole("article", { name: "opus-dev" })).toBeVisible();
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
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  await createOpusProfile(page, info);

  repo = createGitRepo();
  seeded = await seedWorkspace(page, repo);
  await assign(page, seeded, 12, "opus-dev", "running");
  await assign(page, seeded, 14, "opus-dev", "waiting_input");
  const rules = await assign(page, seeded, 16, "opus-dev", "running");
  await assign(page, seeded, 7, "sonnet-review", "running");
  const watcher = await assign(page, seeded, 10, "opus-dev", "queued");
  await assign(page, seeded, 18, "opus-dev", "queued");
  await assign(page, seeded, 29, "opus-dev", "queued");
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
  await dialog.getByLabel("Profil").click();
  await page.getByRole("option", { name: /^opus-dev ·/ }).click();
  await dialog
    .getByLabel("Brief (optionnel)")
    .fill("Implémenter le drag & drop avec @dnd-kit ; garder l'ordre dans le LoroTree.");
  await expect(dialog.getByText(/KIB-15 attend KIB-12 \(en cours\)/)).toBeVisible();
  await expect(dialog.getByText("nouveau worktree kib-15 (depuis main)")).toBeVisible();
  await expect(dialog.getByText(/entrera en file/)).toBeVisible();
  await shot(page, info, "ecran-27");
  await dialog.getByRole("button", { name: "Annuler" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Répondre à opus-dev-2" }).click();
  const journal = page.getByRole("list", { name: "Journal de opus-dev-2" });
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
  await expect(page.getByRole("region", { name: "En attente de réponse" }).getByText("KIB-14")).toBeVisible();
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

  await page.goto(`/#/p/${seeded.projectId}/${encodeURIComponent(seeded.board)}`);
  await page.getByRole("button", { name: "Répondre à opus-dev-2" }).click();
  await page.getByLabel("Réponse à opus-dev-2").fill("Port dynamique, écrit dans ~/.kibo/daemon.json");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await rpc(page, { method: "cancelRun", runId: rules });
  await expect.poll(() => runState(page, "KIB-14"), { timeout: 45_000 }).toBe("done");
  await expect(doing.getByRole("article").filter({ hasText: "KIB-14" })).toBeVisible();
  await page.getByRole("button", { name: "Passer en review" }).click();
  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByText("KIB-14")).toBeVisible();
  await expect(review.getByRole("article").filter({ hasText: "KIB-14" }).getByText("opus-dev")).toBeVisible();
});

test("l'historique ouvre le run cliqué, pour trois agents différents", async ({ page }, info) => {
  if (!seeded) throw new Error("seed missing");
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await assign(page, seeded, 9, "haiku-tests", "queued");
  await page.goto("/#/agents");
  await expect(page.getByRole("heading", { level: 1, name: "Agents" })).toBeVisible();
  await page
    .getByRole("radiogroup", { name: "Filtrer par état" })
    .getByRole("radio", { name: "Tous" })
    .click();
  await filterByProject(page, info);
  const drawer = page.getByRole("region", { name: "Agents" });
  for (const [profile, key] of [
    ["sonnet-review", "KIB-7"],
    ["haiku-tests", "KIB-9"],
    ["opus-dev", "KIB-12"],
  ] as const) {
    await page
      .getByRole("row", { name: new RegExp(`^${key} · `) })
      .getByRole("cell")
      .nth(2)
      .click();
    await expect(
      drawer.getByRole("list", { name: new RegExp(`^Journal de ${profile}(-\\d+)?$`) }),
    ).toBeVisible();
    await expect(drawer.getByText(new RegExp(`^${key} · `)).first()).toBeVisible();
  }
  await shot(page, info, "historique-trois-agents");
});

const prop = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

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
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await rpc(page, { method: "setHost", patch: { hostSlots: 12 } });
  const profile = await rpc(page, {
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "emis-livraison",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 1,
      },
    },
  });
  const run = await rpc(page, {
    method: "assignAgent",
    projectId,
    ticketId,
    profileId: text(profile, "id"),
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
  const drawer = page.getByRole("region", { name: "Agents" });
  await expect(drawer.getByText("1 question ouverte")).toBeVisible();
  await expect(drawer.getByRole("list", { name: "Terminé" })).toContainText("KIB-22 · Terminé · 1 question");
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
  await expect(drawer.getByRole("list", { name: /^Journal de emis-livraison/ })).toContainText(
    "reprise de la session",
  );
  expect((await askedQuestions(page, projectId, ticketId))[0]?.deliveredRunId).toBe(runId);
  await shot(page, info, "ecran-172-transmis");
});
