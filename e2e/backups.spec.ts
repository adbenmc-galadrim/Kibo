import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { homeOf } from "./e2e-home";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

function manualBackupDir(root: string): string | null {
  for (const id of readdirSync(root)) {
    const manifest = join(root, id, "manifest.json");
    if (!existsSync(manifest)) continue;
    if (field(JSON.parse(readFileSync(manifest, "utf8")), "reason") === "manual") return join(root, id);
  }
  return null;
}

test("the backups card saves now, lists, turns off and deletes", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.goto("/#/settings/general");
  await expect(page.getByText("Sauvegardes", { exact: true })).toBeVisible();
  await expect(page.getByText(/^Dernière sauvegarde .* · automatique$/)).toBeVisible();
  await expect(
    page.getByText("Les fichiers de projet (files/) et les secrets ne sont pas inclus."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Choisir le dossier…" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sauvegarder maintenant" }).click();
  await expect(page.getByText(/^Dernière sauvegarde .* · manuelle$/)).toBeVisible();
  await page.getByRole("button", { name: "2 sauvegardes" }).click();
  const rows = page.getByRole("list", { name: "Liste des sauvegardes" }).getByRole("listitem");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("manuelle");
  await shot(page, info, "76-general-sauvegardes");

  const dir = manualBackupDir(join(homeOf(info), "backups"));
  if (!dir) throw new Error("no manual backup on disk");
  const entries = readdirSync(dir);
  expect(entries).toEqual(expect.arrayContaining(["kibo.db", "runs.db", "manifest.json"]));
  expect(entries).not.toContain("token");
  expect(entries).not.toContain("daemon.json");

  await page.getByRole("switch", { name: "Sauvegarde automatique quotidienne" }).click();
  await expect(page.getByText(/^Sauvegarde automatique désactivée/)).toBeVisible();
  const backups = await rpc(page, { method: "getBackups" });
  expect(field(field(field(backups, "status"), "settings"), "enabled")).toBe(false);

  await rows.first().getByRole("button", { name: "Supprimer" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Supprimer cette sauvegarde ?" });
  await shot(page, info, "76-sauvegarde-supprimer");
  await confirm.getByRole("button", { name: "Supprimer" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("button", { name: "1 sauvegarde" })).toBeVisible();
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText("automatique");
  expect(existsSync(dir)).toBe(false);
});
