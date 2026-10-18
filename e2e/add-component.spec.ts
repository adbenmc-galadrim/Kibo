import { expect, type Locator, type Page, test } from "@playwright/test";
import { createPage, pairAndCreateProject } from "./helpers";
import { projectKey, shot } from "./repo-project";

const VIEWPORT = { width: 1280, height: 720 };
test.use({ viewport: VIEWPORT });

const PERSONAL = Array.from({ length: 7 }, (_, i) => ({
  id: `perso-${i + 1}`,
  title: `Composant perso ${i + 1}`,
  builtin: false,
  versions: [
    {
      version: "0.1.0",
      hash: `${i + 1}`.padStart(64, "a"),
      trust: "sandboxed",
      origin: "user",
      active: true,
      tampered: false,
      usages: [],
      revoked: null,
      backend: false,
      manifest: {
        id: `perso-${i + 1}`,
        version: "0.1.0",
        kind: "widget",
        title: `Composant perso ${i + 1}`,
        description: "Widget personnel de démonstration",
        reads: ["ticket"],
        writes: [],
        data: false,
        net: [],
        secrets: [],
        mcp: [],
        capabilities: [],
        embeds: [],
        selection: false,
        configVersion: 0,
        changes: [],
        sdk: 1,
      },
    },
  ],
}));

async function withPersonalComponents(page: Page) {
  await page.route("**/api/rpc", async (route) => {
    const body: unknown = route.request().postDataJSON();
    if (typeof body !== "object" || body === null || Reflect.get(body, "method") !== "listComponents")
      return route.continue();
    const response = await route.fetch();
    const json: unknown = await response.json();
    const result: unknown = typeof json === "object" && json !== null ? Reflect.get(json, "result") : null;
    if (!Array.isArray(result)) throw new Error("listComponents did not answer a list");
    await route.fulfill({ response, json: { ok: true, result: [...result, ...PERSONAL] } });
  });
}

async function expectInViewport(locator: Locator, width: number, height: number) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("element without a box");
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  expect(box.y + box.height).toBeLessThanOrEqual(height);
}

test("ajouter un composant : deux volets, pied visible avec quinze composants", async ({ page }, info) => {
  await withPersonalComponents(page);
  await pairAndCreateProject(page, info, projectKey("ADD", info));
  await createPage(page, "Tableau", "Tableau de bord");
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  const dialog = page.getByRole("dialog", { name: "Ajouter un composant" });
  const list = dialog.getByRole("region", { name: "Composants disponibles" });
  await expect(list.getByRole("radio")).toHaveCount(15);
  await expect(list.getByRole("radio", { name: "Visionneuse 3D" })).toHaveCount(0);
  await expect(list.getByRole("radio", { name: "Source MCP" })).toHaveCount(0);
  await expect(list.getByRole("radio", { name: "Vue d'ensemble" })).toBeVisible();
  const submit = dialog.getByRole("button", { name: "Ajouter à la page" });
  const create = list.getByRole("button", { name: "Créer un composant (code ou IA)" });
  for (const fixed of [submit, dialog.getByRole("button", { name: "Annuler" }), create])
    await expectInViewport(fixed, VIEWPORT.width, VIEWPORT.height);

  await list.getByRole("radio", { name: "Composant perso 7" }).click();
  await expect(dialog.getByRole("region", { name: "Description du composant" })).toContainText(
    "Composant perso 7",
  );
  await expectInViewport(submit, VIEWPORT.width, VIEWPORT.height);
  await expectInViewport(dialog, VIEWPORT.width, VIEWPORT.height);
  expect(await dialog.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);
  await list.getByRole("radio", { name: "Kanban" }).click();
  await shot(page, info, "ecran-3-deux-volets");

  await page.setViewportSize({ width: 640, height: 720 });
  await expectInViewport(submit, 640, VIEWPORT.height);
  await expect(dialog.getByRole("region", { name: "Description du composant" })).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollHeight - el.clientHeight)).toBe(0);
  await shot(page, info, "ecran-3-etroit");

  await page.setViewportSize(VIEWPORT);
  await submit.click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("main").getByRole("button", { name: "Actions Kanban" })).toBeVisible();
});
