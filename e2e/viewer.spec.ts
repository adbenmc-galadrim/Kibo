import { sampleGlb } from "@kibo/sdk/fixtures";
import { expect, type Locator, type Page, test } from "@playwright/test";
import { coloredGlb } from "../packages/sdk/src/three/glb-test-kit";
import { rpc, text } from "./agents-seed";
import { centerPatch, colorGap, hueGap, meanColor, type Rgb, share, srgbOf, toHsv } from "./canvas-pixels";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

const CUBE_ORANGE = srgbOf([0.98, 0.45, 0.09]);
const SETTINGS_SAVED_MS = 15_000;
const UNAVAILABLE = "Affichage 3D indisponible sur cet appareil.";

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function uploadGlb(page: Page, projectId: string, name: string, bytes: Uint8Array) {
  const begun = await rpc(page, {
    method: "beginAssetUpload",
    projectId,
    name,
    mime: "model/gltf-binary",
    size: bytes.byteLength,
  });
  const uploadId = text(begun, "uploadId");
  await rpc(page, {
    method: "appendAssetUpload",
    uploadId,
    index: 0,
    bytes: Buffer.from(bytes).toString("base64"),
  });
  await rpc(page, { method: "finishAssetUpload", uploadId });
}

async function openSettings(page: Page): Promise<Locator> {
  await page.getByRole("main").getByRole("button", { name: "Actions Visionneuse 3D" }).click();
  await page.getByRole("menuitem", { name: "Réglages…" }).click();
  return page.getByRole("dialog");
}

async function chooseModel(page: Page, model: string, still = false) {
  const dialog = await openSettings(page);
  await dialog.getByRole("combobox", { name: "Modèle (.glb)" }).click();
  await page.getByRole("option", { name: model }).click();
  if (still) {
    const rotate = dialog.getByRole("switch", { name: "Rotation automatique" });
    if ((await rotate.getAttribute("aria-checked")) === "true") await rotate.click();
    await expect(rotate).toHaveAttribute("aria-checked", "false");
  }
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden({ timeout: SETTINGS_SAVED_MS });
}

function expectOrange(color: Rgb) {
  const seen = toHsv(color);
  const reference = toHsv(CUBE_ORANGE);
  expect(hueGap(seen.h, reference.h)).toBeLessThan(5);
  expect(seen.s).toBeGreaterThan(reference.s * 0.95);
}

const modelCanvas = (page: Page, model: string) =>
  page.getByRole("main").locator(`canvas[role="img"][aria-label="Modèle 3D ${model}"]`);

async function startViewer(
  page: Page,
  info: Parameters<typeof shot>[1],
  key: string,
  models: Record<string, Uint8Array>,
) {
  const run = String.fromCharCode(65 + ((info.repeatEachIndex + info.retry) % 26));
  await pairAndCreateProject(page, info, projectKey(`${key}${run}`, info));
  for (const [name, bytes] of Object.entries(models)) await uploadGlb(page, projectIdOf(page), name, bytes);
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Visionneuse 3D", SETTINGS_SAVED_MS);
}

test("la visionneuse affiche le modèle choisi dans les réglages", async ({ page }, info) => {
  test.setTimeout(90_000);
  const files: { url: string; status: number }[] = [];
  page.on("response", (res) => {
    if (new URL(res.url()).pathname.startsWith("/f/")) files.push({ url: res.url(), status: res.status() });
  });
  await startViewer(page, info, "VUE", { "cube.glb": sampleGlb() });
  const main = page.getByRole("main");
  await expect(main.getByText("Choisis un fichier .glb dans les réglages du widget.")).toBeVisible();
  await shot(page, info, "visionneuse-vide");

  await chooseModel(page, "cube.glb");
  const canvas = modelCanvas(page, "cube.glb");
  const fallback = main.getByText(UNAVAILABLE);
  await expect(canvas.or(fallback)).toBeVisible();
  await expect(main.getByText("Chargement du modèle…")).toBeHidden();
  expect(files.length).toBeGreaterThan(0);
  expect(files.every((f) => f.status === 200)).toBe(true);
  await shot(page, info, "visionneuse-modele");

  const filesBefore = files.length;
  const settings = await openSettings(page);
  await settings.getByRole("combobox", { name: "Éclairage" }).click();
  await page.getByRole("option", { name: "Studio" }).click();
  await settings.getByRole("switch", { name: "Ombres" }).click();
  await settings.getByLabel("Intensité").fill("1.5");
  await settings.getByRole("button", { name: "Enregistrer" }).click();
  await expect(settings).toBeHidden();
  await expect(canvas.or(fallback)).toBeVisible();
  expect(files.length).toBe(filesBefore);
  await shot(page, info, "visionneuse-eclairage-studio");

  const toggle = main.getByRole("button", { name: "Éclairage" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  const panel = main.getByRole("form", { name: "Réglages d'éclairage" });
  await expect(panel.getByRole("radio", { name: "Studio" })).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByText("1,5×")).toBeVisible();
  await panel.getByRole("radio", { name: "Contraste" }).click();
  await panel.getByRole("switch", { name: "Lumière d'ambiance" }).click();
  await shot(page, info, "visionneuse-volet-eclairage");
  await expect(panel.getByRole("alert")).toHaveCount(0);
  const reopened = await openSettings(page);
  await expect(reopened.getByRole("combobox", { name: "Éclairage" })).toHaveText("Contraste");
  await expect(reopened.getByRole("switch", { name: "Lumière d'ambiance" })).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(reopened.getByRole("switch", { name: "Ombres" })).toHaveAttribute("aria-checked", "true");
  await expect(reopened.getByLabel("Intensité")).toHaveValue("1.5");
  await shot(page, info, "visionneuse-reglages-eclairage");
  await reopened.getByRole("button", { name: "Annuler" }).click();
  await expect(reopened).toBeHidden();
  expect(files.length).toBe(filesBefore);
});

test("couleurs fidèles, volet d'éclairage mesurable, texture intégrée", async ({ page }, info) => {
  test.setTimeout(90_000);
  const problems: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" || /Content Security Policy/.test(msg.text())) problems.push(msg.text());
  });
  await startViewer(page, info, "COU", { "cube.glb": sampleGlb(), "damier.glb": coloredGlb() });
  await chooseModel(page, "cube.glb", true);
  const main = page.getByRole("main");
  const cube = modelCanvas(page, "cube.glb");
  await expect(cube).toBeVisible();
  await expect(main.getByText("Chargement du modèle…")).toBeHidden();

  const face = async () => meanColor(await centerPatch(cube, 12));
  await expect.poll(async () => toHsv(await face()).s).toBeGreaterThan(0.3);
  const soft = await face();
  expectOrange(soft);
  await shot(page, info, "visionneuse-orange");

  const toggle = main.getByRole("button", { name: "Éclairage" });
  await toggle.click();
  const panel = main.getByRole("form", { name: "Réglages d'éclairage" });
  await panel.getByRole("radio", { name: "Contraste" }).click();
  await expect.poll(async () => colorGap(await face(), soft)).toBeGreaterThan(8);
  const contrast = await face();
  await panel.getByRole("slider", { name: "Intensité" }).focus();
  await page.keyboard.press("End");
  await expect(panel.getByText("2,0×")).toBeVisible();
  await expect.poll(async () => toHsv(await face()).v).toBeGreaterThan(toHsv(contrast).v + 0.1);
  expectOrange(await face());
  await shot(page, info, "visionneuse-volet-mesure");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();
  await toggle.click();
  await expect(panel.getByRole("radio", { name: "Contraste" })).toHaveAttribute("aria-checked", "true");
  await expect(panel.getByText("2,0×")).toBeVisible();
  const saved = await openSettings(page);
  await expect(saved.getByRole("combobox", { name: "Éclairage" })).toHaveText("Contraste");
  await expect(saved.getByLabel("Intensité")).toHaveValue("2");
  await saved.getByRole("button", { name: "Annuler" }).click();

  await chooseModel(page, "damier.glb");
  const board = modelCanvas(page, "damier.glb");
  await expect(board).toBeVisible();
  await expect(main.getByText("Chargement du modèle…")).toBeHidden();
  const checker = async () => {
    const pixels = await centerPatch(board, 30);
    return {
      red: share(pixels, (c) => c.s > 0.5 && hueGap(c.h, 0) < 20),
      blue: share(pixels, (c) => c.s > 0.5 && hueGap(c.h, 228) < 20),
    };
  };
  await expect.poll(async () => Math.min(...Object.values(await checker()))).toBeGreaterThan(0.05);
  await shot(page, info, "visionneuse-texture");
  expect(problems).toEqual([]);
});
