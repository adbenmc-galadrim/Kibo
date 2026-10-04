import { homedir } from "node:os";
import { expect, test } from "@playwright/test";
import { shot } from "./repo-project";
import { E2E_TOKEN } from "./token";

test.describe.configure({ mode: "serial" });
test.use({ viewport: { width: 1440, height: 900 } });

const ISSUE_URL =
  "https://github.com/adbenmc-galadrim/Kibo/issues/new?template=probleme.yml&title=Probl%C3%A8me%20%3A%20";

test("mod+/ opens the shortcuts help, which links to the settings page, and Escape closes it", async ({
  page,
}, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("tablist", { name: "Onglets" })).toBeVisible();
  await page.keyboard.press("ControlOrMeta+/");
  const help = page.getByRole("dialog", { name: "Raccourcis" });
  await expect(help).toBeVisible();
  for (const name of ["Navigation", "Palette", "Code"])
    await expect(help.getByRole("region", { name })).toBeVisible();
  await expect(help.getByText("Aide des raccourcis")).toBeVisible();
  await shot(page, info, "139-raccourcis");
  await page.keyboard.press("Escape");
  await expect(help).toBeHidden();
  await page.keyboard.press("ControlOrMeta+/");
  await help.getByRole("link", { name: "Voir dans les Paramètres" }).click();
  await expect(help).toBeHidden();
  await expect(page.getByRole("heading", { level: 1, name: "Raccourcis" })).toBeVisible();
});

test("the help menu shows the whole report, without token nor personal folder, and copies it", async ({
  page,
  context,
}, info) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await page.getByRole("button", { name: /^Menu de / }).click();
  await page.getByRole("menuitem", { name: "Aide" }).click();
  await page.getByRole("menuitem", { name: "Signaler un problème" }).click();
  const dialog = page.getByRole("dialog", { name: "Signaler un problème" });
  const report = dialog.getByRole("region", { name: "Rapport" });
  await expect(report).toContainText("Kibo 1.4.0");
  await expect(report).toContainText("navigateur");
  await expect(report).toContainText("## Journal (50 dernières lignes)");
  const text = (await report.textContent()) ?? "";
  expect(text).not.toContain(E2E_TOKEN);
  expect(text).not.toContain(`${homedir()}/`);
  expect(text).not.toContain("[object Object]");
  const issue = dialog.getByRole("link", { name: "Ouvrir une issue GitHub" });
  await expect(issue).toHaveAttribute("href", ISSUE_URL);
  await shot(page, info, "138-signaler");
  await dialog.getByRole("checkbox", { name: "Inclure le journal" }).click();
  await expect(report).not.toContainText("Journal");
  await dialog.getByRole("button", { name: "Copier" }).click();
  await expect(dialog.getByRole("button", { name: "Copié" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("## Application\n- Kibo 1.4.0");
  expect(copied).not.toContain("Journal");
  expect(copied).not.toContain(E2E_TOKEN);
});
