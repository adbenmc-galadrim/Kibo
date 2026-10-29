import { sampleGlb } from "@kibo/sdk/fixtures";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.setTimeout(240_000);

const cube = () => ({
  name: "Cube Demo.glb",
  mimeType: "model/gltf-binary",
  buffer: Buffer.from(sampleGlb()),
});

async function openProjectFiles(page: Page, key: string): Promise<Locator> {
  await page.getByRole("button", { name: `Actions de Kibo ${key}` }).click();
  await page.getByRole("menuitem", { name: "Fichiers du projet…" }).click();
  const dialog = page.getByRole("dialog", { name: "Fichiers du projet" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function importCube(dialog: Locator) {
  await dialog.getByLabel("Choisir des fichiers à importer").setInputFiles(cube());
}

test("fichiers du projet : import, doublon refusé, suppression", async ({ page }, info) => {
  const key = projectKey("FIL", info);
  await pairAndCreateProject(page, info, key);

  const files = await openProjectFiles(page, key);
  await expect(
    files.getByText(/^Aucun fichier\. Exporte depuis Blender en glTF Binary \(\.glb\)/),
  ).toBeVisible();
  await expect(files.getByText(new RegExp(`^Dossier : .*files/${key} · 0 o utilisés$`))).toBeVisible();
  await importCube(files);
  const row = files.getByRole("row").filter({ hasText: "cube-demo.glb" });
  await expect(row).toBeVisible();
  await expect(row.getByRole("cell", { name: "Modèle", exact: true })).toBeVisible();
  await shot(page, info, "fichiers-du-projet");

  await importCube(files);
  await expect(files.getByRole("alert")).toHaveText("cube-demo.glb · Un fichier porte déjà ce nom.");
  await files.getByRole("button", { name: "Supprimer cube-demo.glb" }).click();
  const confirm = page.getByRole("alertdialog", { name: "Supprimer cube-demo.glb ?" });
  await confirm.getByRole("button", { name: "Supprimer" }).click();
  await expect(row).toHaveCount(0);
  await importCube(files);
  await expect(row).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(files).toBeHidden();
});

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const bigPng = (name: string) => ({
  name,
  mimeType: "image/png",
  buffer: Buffer.concat([Buffer.from(PNG_SIGNATURE), Buffer.alloc(6 * 1024 * 1024)]),
});

async function slowAppends(page: Page) {
  await page.route("**/api/rpc", async (route) => {
    if (route.request().postData()?.includes('"appendAssetUpload"'))
      await new Promise((resolve) => setTimeout(resolve, 120));
    await route.continue();
  });
}

async function sampleBars(page: Page) {
  await page.evaluate(() => {
    const samples: Record<string, number[]> = {};
    Object.assign(window, { barSamples: samples });
    const tick = () => {
      for (const bar of Array.from(document.querySelectorAll('[role="progressbar"]'))) {
        const name = bar.getAttribute("aria-label") ?? "";
        samples[name] = [...(samples[name] ?? []), Number(bar.getAttribute("aria-valuenow"))];
      }
      requestAnimationFrame(tick);
    };
    tick();
  });
}

const readSamples = (page: Page) =>
  page.evaluate(() => (window as unknown as { barSamples: Record<string, number[]> }).barSamples);

test("la progression d'un import par morceaux monte sans jamais reculer", async ({ page }, info) => {
  const key = projectKey("FIP", info);
  await pairAndCreateProject(page, info, key);
  const files = await openProjectFiles(page, key);
  await slowAppends(page);
  await sampleBars(page);
  await files.getByLabel("Choisir des fichiers à importer").setInputFiles([bigPng("a.png"), bigPng("b.png")]);
  const uploads = files.getByRole("list", { name: "Envois en cours" });
  await expect(uploads.getByRole("progressbar")).toHaveCount(2);
  await expect(uploads.getByRole("progressbar", { name: "Envoi de a.png" })).toHaveAttribute(
    "aria-valuenow",
    /^[3-9]\d$/,
  );
  await shot(page, info, "fichiers-envoi-en-cours");
  await expect(files.getByRole("row").filter({ hasText: "b.png" })).toBeVisible({ timeout: 60_000 });
  await expect(uploads).toHaveCount(0);
  const samples = await readSamples(page);
  for (const name of ["Envoi de a.png", "Envoi de b.png"]) {
    const values = samples[name] ?? [];
    expect(values.every((v, i) => i === 0 || v >= (values[i - 1] ?? 0))).toBe(true);
    expect(new Set(values).size).toBeGreaterThan(20);
    expect(values.at(-1)).toBe(100);
  }
});
