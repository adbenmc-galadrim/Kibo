import { expect, test } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { siloPageUrl } from "./pixel-silo";
import { loadSilo } from "./planning-kit";
import { prRefOf, showPrs } from "./prs-kit";

test.describe.configure({ mode: "serial" });

test("the PRs view of the Silo Graphe shows the stacked pull requests", async ({ page }) => {
  await pairBrowser(page);
  const silo = await loadSilo(page);
  expect(await prRefOf(page, silo, 33, 24)).toMatchObject({
    state: "draft",
    base: "feat/silo-32",
    head: "feat/envoi-hors-ligne",
  });
  await page.goto(await siloPageUrl(page, "Graphe"));
  await showPrs(page);
});
