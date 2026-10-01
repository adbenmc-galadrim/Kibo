import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { createE2eRepo, type E2eRepo, fakeGhDir } from "./git-repo";
import { createRepoProject, gatePushes, projectKey, shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.use({ viewport: { width: 1440, height: 900 } });

const repos: E2eRepo[] = [];
test.afterEach(async () => {
  for (const repo of repos.splice(0)) await expect(() => repo.remove()).toPass();
});

function newRepo(key: string): E2eRepo {
  const repo = createE2eRepo(key);
  repos.push(repo);
  return repo;
}

type GhCall = { args: string[]; stdin: string };

function ghCalls(page: Page): GhCall[] {
  const log = join(fakeGhDir(new URL(page.url()).port), "log.jsonl");
  return readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const call: GhCall = JSON.parse(line);
      return call;
    });
}

function editTicketFile(repo: E2eRepo) {
  const current = readFileSync(join(repo.repo, "src/ticket.ts"), "utf8");
  repo.write(
    "src/ticket.ts",
    current.replace("line2 = 2;", "line2 = 20;").replace("line29 = 29;", "line29 = 290;"),
  );
}

test("modifier → indexer un bloc → commit → amend → PR", async ({ page }, info) => {
  const key = projectKey("GIT", info);
  const repo = newRepo(key);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, `Code ${key}`, key, repo.repo);

  await page.keyboard.press("ControlOrMeta+k");
  const palette = page.getByRole("dialog", { name: "Palette de commandes" });
  await palette.getByRole("combobox").fill("nouveau ticket");
  await expect(palette.getByRole("option", { name: "Nouveau ticket" })).toBeVisible();
  await shot(page, info, "ecran-18");
  await palette.getByRole("option", { name: "Nouveau ticket" }).click();
  await page.getByLabel("Titre").fill("Schéma Loro des tickets (LoroTree)");
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  editTicketFile(repo);
  const changes = page.getByRole("button", { name: /^Changements/ });
  await expect(changes).toBeVisible();
  await changes.click();
  await expect(page.getByRole("tab", { name: `Code ${key} · Changements` })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("navigation", { name: "Fil d'Ariane" }).getByText(repo.branch)).toBeVisible();

  await page
    .getByRole("button", { name: /ticket\.ts/ })
    .first()
    .click();
  await page.getByRole("button", { name: "Ajouter le bloc au commit" }).first().click();
  await expect(
    page.getByRole("group", { name: /^Dans le prochain commit \(/ }).getByText("ticket.ts"),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: /^Modifications \(/ }).getByText("ticket.ts")).toBeVisible();
  expect(repo.git("diff", "--cached")).toContain("line2 = 20");
  expect(repo.git("diff", "--cached")).not.toContain("line29 = 290");

  await page.getByRole("radio", { name: "Côte à côte" }).click();
  await expect(page.getByRole("radio", { name: "Côte à côte" })).toBeChecked();
  await page.getByRole("radio", { name: "Unifié" }).click();

  const message = page.getByLabel("Message");
  await expect(message).toHaveValue(`feat: schéma Loro des tickets (${key}-1)`);
  await shot(page, info, "ecran-21");
  await page.getByRole("button", { name: `Commit sur ${repo.branch}` }).click();
  await expect(page.getByText("↑1").first()).toBeVisible();
  expect(repo.git("log", "-1", "--format=%s").trim()).toBe(`feat: schéma Loro des tickets (${key}-1)`);

  await page.getByRole("checkbox", { name: /Ajouter src\/ticket\.ts au commit/ }).click();
  await expect(page.getByRole("group", { name: /^Modifications \(/ }).getByText("ticket.ts")).toHaveCount(0);
  const latest = page.getByRole("listitem").filter({ hasText: `(${key}-1)` });
  await latest.getByRole("button", { name: "Modifier" }).click();
  await expect(page.getByRole("checkbox", { name: "Modifier le dernier commit (non poussé)" })).toBeChecked();
  await message.fill(`feat: schéma Loro complet (${key}-1)`);
  await page.getByRole("button", { name: `Modifier le commit sur ${repo.branch}` }).click();
  await expect(page.getByText("Aucun changement dans ce worktree.")).toBeVisible();
  expect(repo.git("log", "--format=%s", "main..HEAD").trim()).toBe(`feat: schéma Loro complet (${key}-1)`);
  expect(repo.git("show", "HEAD", "--", "src/ticket.ts")).toContain("line29 = 290");

  await page.getByRole("button", { name: "Pousser et créer la PR" }).click();
  const dialog = page.getByRole("dialog", { name: "Pousser et créer la PR" });
  await expect(dialog.getByText(`${repo.branch} → main · 1 commit non poussé · 1 fichier`)).toBeVisible();
  await expect(dialog.getByLabel("Titre")).toHaveValue(`feat: schéma Loro des tickets (${key}-1)`);
  await shot(page, info, "ecran-22");
  await dialog.getByRole("button", { name: "Créer la PR" }).click();
  await expect(page.getByText(/PR #\d+ créée/)).toBeVisible();
  await expect(page.getByRole("link", { name: /Voir la PR #\d+/ })).toBeVisible();
  await shot(page, info, "ecran-42");
  const create = ghCalls(page).find(
    (c) => c.args[1] === "create" && c.args.includes(`--head=${repo.branch}`),
  );
  expect(create?.args).toContain("--draft");
  expect(create?.stdin).toContain(`## Ticket\n${key}-1 · Schéma Loro des tickets (LoroTree)`);
  expect(repo.git("ls-remote", "origin", repo.branch).trim()).not.toBe("");

  await page.keyboard.press("ControlOrMeta+k");
  await palette.getByRole("combobox").fill(`${key}-1`);
  await page.keyboard.press("ControlOrMeta+Enter");
  const sheet = page.getByRole("dialog").filter({ hasText: "Schéma Loro des tickets" });
  await expect(sheet.getByRole("link", { name: /#\d+/ })).toBeVisible();
});

test("push en cours, en échec puis réessayé", async ({ page }, info) => {
  const key = projectKey("PSH", info);
  const repo = newRepo(key);
  const gate = gatePushes(repo.remote);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await createRepoProject(page, `Push ${key}`, key, repo.repo);
  await page.getByRole("button", { name: "Ticket", exact: true }).click();
  await page.getByLabel("Titre").fill("Push de test");
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  editTicketFile(repo);
  await page.getByRole("button", { name: /^Changements/ }).click();
  await page.getByRole("checkbox", { name: /Ajouter src\/ticket\.ts au commit/ }).click();
  await expect(
    page.getByRole("group", { name: /^Dans le prochain commit \(/ }).getByText("ticket.ts"),
  ).toBeVisible();
  await expect(page.getByLabel("Message")).toHaveValue(`feat: push de test (${key}-1)`);
  await page.getByRole("button", { name: `Commit sur ${repo.branch}` }).click();
  await expect(page.getByText("Aucun changement dans ce worktree.")).toBeVisible();

  try {
    await page.getByRole("button", { name: "Pousser", exact: true }).click();
    await expect(page.getByRole("button", { name: `Envoi vers origin/${repo.branch}…` })).toBeDisabled();
    await shot(page, info, "ecran-40");
  } finally {
    gate.open({ fail: true });
  }
  await expect(page.getByText("Le push a échoué")).toBeVisible();
  await expect(page.getByText(/push refusé par le dépôt distant/)).toBeVisible();
  await shot(page, info, "ecran-41");

  gate.open({ fail: false });
  await page.getByRole("button", { name: "Réessayer" }).click();
  await expect(
    page.getByText(`Rien à pousser : la branche est à jour avec origin/${repo.branch}.`),
  ).toBeVisible();
  expect(repo.git("ls-remote", "origin", repo.branch).trim()).not.toBe("");
});
