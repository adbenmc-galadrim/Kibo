import { sampleGlb } from "@kibo/sdk/fixtures";
import { expect, type Page, test } from "@playwright/test";
import { rpc, text } from "./agents-seed";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.use({ viewport: { width: 1440, height: 900 } });

const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

async function uploadCube(page: Page, projectId: string) {
  const bytes = sampleGlb();
  const begun = await rpc(page, {
    method: "beginAssetUpload",
    projectId,
    name: "cube.glb",
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

test("la visionneuse affiche le modèle choisi dans les réglages", async ({ page }, info) => {
  const files: { url: string; status: number }[] = [];
  page.on("response", (res) => {
    if (new URL(res.url()).pathname.startsWith("/f/")) files.push({ url: res.url(), status: res.status() });
  });
  await pairAndCreateProject(page, info, projectKey("VUE", info));
  await uploadCube(page, projectIdOf(page));
  await createPage(page, "Tableau de bord", "Tableau de bord");
  await addComponent(page, "Visionneuse 3D");
  const main = page.getByRole("main");
  await expect(main.getByText("Choisis un fichier .glb dans les réglages du widget.")).toBeVisible();
  await shot(page, info, "visionneuse-vide");

  await main.getByRole("button", { name: "Actions Visionneuse 3D" }).click();
  await page.getByRole("menuitem", { name: "Réglages…" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Modèle (.glb)" }).click();
  await page.getByRole("option", { name: "cube.glb" }).click();
  await dialog.getByRole("button", { name: "Enregistrer" }).click();
  await expect(dialog).toBeHidden();

  const canvas = main.locator('canvas[role="img"][aria-label="Modèle 3D cube.glb"]');
  const fallback = main.getByText("Affichage 3D indisponible sur cet appareil.");
  await expect(canvas.or(fallback)).toBeVisible();
  await expect(main.getByText("Chargement du modèle…")).toBeHidden();
  expect(files.length).toBeGreaterThan(0);
  expect(files.every((f) => f.status === 200)).toBe(true);
  await shot(page, info, "visionneuse-modele");
});
