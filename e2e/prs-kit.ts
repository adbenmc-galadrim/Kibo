import { expect, type Locator, type Page } from "@playwright/test";
import { list, rpc } from "./agents-seed";
import { siloKey } from "./fixtures/silo-maquettes";
import { SILO_PRS_COUNTER } from "./fixtures/silo-prs";
import type { Silo } from "./planning-kit";
import { field } from "./record-field";

export const PRS_SCREENS_DIR = "2026-10-20-p30";

export const prsCounter = (page: Page): Locator => page.getByText(SILO_PRS_COUNTER, { exact: true });

export async function selectPrs(page: Page): Promise<void> {
  await page.getByRole("group", { name: "Vue" }).getByRole("radio", { name: "PRs" }).click();
}

export async function showPrs(page: Page): Promise<void> {
  await selectPrs(page);
  await expect(prsCounter(page)).toBeVisible();
}

export async function prRefOf(page: Page, silo: Silo, n: number, number: number): Promise<unknown> {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "key") === siloKey(n));
  const refs = field(ticket, "externalRefs");
  return (Array.isArray(refs) ? refs : []).find(
    (r) => field(r, "kind") === "github_pr" && field(r, "number") === number,
  );
}
