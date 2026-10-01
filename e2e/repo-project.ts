import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";
import { skipRoleStep } from "./helpers";

export const projectKey = (base: string, info: TestInfo) =>
  `${base}${info.project.name.endsWith("light") ? "L" : "D"}`;

export async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
}

export async function createRepoProject(page: Page, name: string, key: string, folder: string) {
  await page.getByRole("button", { name: "Nouveau projet" }).first().click();
  await skipRoleStep(page);
  await page.getByLabel("Nom", { exact: true }).fill(name);
  await page.getByLabel("Clé").fill(key);
  await page.getByLabel("Dossier du projet").fill(folder);
  await page.getByRole("button", { name: "Créer le projet" }).click();
  await expect(page.getByText("Projet créé")).toBeVisible();
}

export type PushGate = { open(options: { fail: boolean }): void };

export function gatePushes(remote: string): PushGate {
  const hook = join(remote, "hooks", "pre-receive");
  const opened = join(remote, "gate-open");
  const failing = join(remote, "gate-fail");
  writeFileSync(
    hook,
    [
      "#!/bin/sh",
      `while [ ! -f '${opened}' ]; do sleep 0.05; done`,
      `if [ -f '${failing}' ]; then echo 'push refusé par le dépôt distant' >&2; exit 1; fi`,
      "",
    ].join("\n"),
    { mode: 0o755 },
  );
  return {
    open({ fail }) {
      if (fail) writeFileSync(failing, "");
      else rmSync(failing, { force: true });
      writeFileSync(opened, "");
    },
  };
}
