import { rmSync } from "node:fs";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { assign, createGitRepo, rpc, seedWorkspace } from "./agents-seed";
import { E2E_TOKEN } from "./token";

test.setTimeout(180_000);
test.use({ viewport: { width: 1440, height: 900 } });

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

test("agents au travail : cartes, file, journal, réponse, review", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  await rpc(page, { method: "setHost", patch: { hostSlots: 3 } });
  await createOpusProfile(page, info);

  repo = createGitRepo();
  const seeded = await seedWorkspace(page, repo);
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
  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByText("KIB-14")).toBeVisible({ timeout: 45_000 });
  await expect(review.getByRole("article").filter({ hasText: "KIB-14" }).getByText("opus-dev")).toBeVisible();
});
