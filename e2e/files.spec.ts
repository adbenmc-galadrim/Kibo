import { sampleGlb } from "@kibo/sdk/fixtures";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { rpc } from "./agents-seed";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.setTimeout(240_000);

const DRAFT = "viewer";
const TITLE = "Viewer";
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

async function publishViewer(page: Page) {
  await rpc(page, { method: "previewPublish", id: DRAFT });
  await page.getByRole("button", { name: "Composants", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Composants" })).toBeVisible();
  const draft = page.getByRole("listitem").filter({ hasText: TITLE });
  await expect(draft.getByText("Tests verts")).toBeVisible({ timeout: 120_000 });
  await draft.getByRole("button", { name: "Publier" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(`Publier « ${TITLE} » 0.1.0`)).toBeVisible({ timeout: 120_000 });
  await dialog.getByRole("button", { name: "Publier 0.1.0" }).click();
}

test("fichiers du projet, capacités à l'écran 30, CSP du composant", async ({ page }, info) => {
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

  await publishViewer(page);
  const trust = page.getByRole("dialog", { name: `Autoriser « ${TITLE} » 0.1.0 ?` });
  await expect(trust.getByText("Lire les manettes branchées")).toBeVisible({ timeout: 60_000 });
  await expect(trust.getByText("Lire les fichiers du projet")).toBeVisible();
  await expect(trust.getByText("Aucun accès réseau", { exact: true })).toBeVisible();
  await expect(trust.getByText("Aucun accès réseau, aucun fichier local")).toHaveCount(0);
  await shot(page, info, "ecran-30-capacites");
  await trust.getByRole("button", { name: "Autoriser" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fermer" }).click();

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await createPage(page, "Visionneuse", "Tableau de bord");
  await addComponent(page, TITLE);
  const iframe = page.locator(`iframe[title="${TITLE}"]`);
  const allow = (await iframe.getAttribute("allow")) ?? "";
  expect(allow).toContain("gamepad *");
  expect(allow).toContain("autoplay 'none'");
  await expect(page.frameLocator(`iframe[title="${TITLE}"]`).getByText("1 fichiers")).toBeVisible();

  const src = await iframe.getAttribute("src");
  if (!src) throw new Error("the viewer iframe has no src");
  expect(new URL(src).pathname).toMatch(/^\/c\/viewer\/0\.1\.0\/[0-9a-f]+\/index\.html$/);
  const csp = (await page.request.get(src)).headers()["content-security-policy"] ?? "";
  expect(csp).toContain("connect-src 'self'");
  expect(csp).not.toContain("media-src");
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
