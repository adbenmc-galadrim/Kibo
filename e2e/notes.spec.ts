import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { homeOf } from "./e2e-home";
import { addComponent, createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });
test.setTimeout(120_000);

const RICH = [
  "# Journal",
  "",
  "## Décisions",
  "",
  "Un **mot** important, un peu d'*italique*, du ~~barré~~ et `du code`.",
  "",
  "- [x] relire la spec",
  "- [ ] écrire le plan",
  "",
  "```ts",
  "const answer: number = 42;",
  'export function greet(name: string) { return "bonjour " + name; }',
  "```",
  "",
].join("\n");

async function openNewNote(page: Page, title: string) {
  await page.getByRole("button", { name: "Nouvelle note" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle note" });
  await dialog.getByLabel("Titre").fill(title);
  await dialog.getByRole("button", { name: "Créer" }).click();
  await expect(dialog).toBeHidden();
  const editor = page.getByRole("textbox", { name: "Contenu de la note" });
  await expect(editor).toBeVisible();
  return editor;
}

test("éditeur : barre d'outils, aperçu en direct, menu /, enregistré sur disque", async ({ page }, info) => {
  const key = projectKey("NOT", info);
  await pairAndCreateProject(page, info, key);
  await createPage(page, "Notes", "Vue");
  await addComponent(page, "Notes");
  const editor = await openNewNote(page, "Journal");
  await editor.click();
  await page.keyboard.press("ControlOrMeta+a");
  await page.keyboard.type("# Journal\n\nun mot ici\n\n");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("Home");
  for (let i = 0; i < 3; i++) await page.keyboard.press("ArrowRight");
  for (let i = 0; i < 3; i++) await page.keyboard.press("Shift+ArrowRight");
  await page
    .getByRole("toolbar", { name: "Mise en forme", exact: true })
    .getByRole("button", { name: "Gras" })
    .click();
  await page.keyboard.press("ControlOrMeta+End");
  await expect(editor.locator(".cm-line").nth(2)).toHaveText("un mot ici");
  await expect(editor.locator(".cm-line").nth(0)).toHaveText("Journal");
  await page.keyboard.type("/case");
  await page.locator(".cm-tooltip-autocomplete").getByText("Case à cocher").click();
  await page.keyboard.type("relire");
  await expect(page.getByText("Enregistré • local")).toBeVisible({ timeout: 5_000 });
  const file = join(homeOf(info), "notes", key, "journal.md");
  await expect.poll(() => (existsSync(file) ? readFileSync(file, "utf8") : "")).toContain("un **mot** ici");
  expect(readFileSync(file, "utf8")).toContain("- [ ] relire");

  await page.getByRole("button", { name: "Aperçu" }).click();
  writeFileSync(file, RICH);
  await expect(page.getByRole("heading", { level: 2, name: "Décisions" })).toBeVisible({ timeout: 5_000 });
  await page.getByRole("button", { name: "Modifier" }).click();
  await expect(editor.locator(".cm-line").nth(2)).toHaveText("Décisions");
  await expect(editor.getByRole("checkbox", { name: "Case à cocher, cochée" })).toBeVisible();
  await editor.getByRole("checkbox", { name: "Case à cocher, non cochée" }).click();
  await expect.poll(() => readFileSync(file, "utf8")).toContain("- [x] écrire le plan");
  await editor.locator(".cm-line").last().click();
  await shot(page, info, "notes-apercu-direct");

  await page.keyboard.press("ControlOrMeta+End");
  await page.keyboard.press("Enter");
  await editor.evaluate(async (el) => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2d context");
    const gradient = ctx.createLinearGradient(0, 0, 480, 200);
    gradient.addColorStop(0, "#f97316");
    gradient.addColorStop(1, "#3f3f46");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 480, 200);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 40px sans-serif";
    ctx.fillText("Capture collée", 40, 115);
    const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/png"));
    if (!blob) throw new Error("no png");
    const data = new DataTransfer();
    data.items.add(new File([blob], "pasted.png", { type: "image/png" }));
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  });
  await expect(editor).toContainText("![](assets/journal-");
  const assets = join(homeOf(info), "notes", key, "assets");
  await expect
    .poll(() => (existsSync(assets) ? readdirSync(assets) : []))
    .toEqual([expect.stringMatching(/^journal-\d{8}-\d{6}\.png$/)]);
  await expect.poll(() => readFileSync(file, "utf8")).toMatch(/!\[\]\(assets\/journal-\d{8}-\d{6}\.png\)/);
  await shot(page, info, "notes-image-edition");
  await page.getByRole("button", { name: "Aperçu" }).click();
  const image = page.locator("img[data-asset]");
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(480);
  await shot(page, info, "notes-image-apercu");

  writeFileSync(file, `${readFileSync(file, "utf8")}\n![](assets/absent.png)\n`);
  await expect(page.getByRole("img", { name: "Image introuvable" })).toBeVisible({ timeout: 5_000 });
  await expect(image).toHaveAttribute("src", /^data:image\/png;base64,/);
  await shot(page, info, "notes-image-introuvable");
});
