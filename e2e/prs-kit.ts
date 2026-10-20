import { expect, type Locator, type Page } from "@playwright/test";
import { list, rpc, text } from "./agents-seed";
import { siloKey } from "./fixtures/silo-maquettes";
import { SILO_PRS_COUNTER } from "./fixtures/silo-prs";
import type { Silo } from "./planning-kit";
import { field } from "./record-field";

export const PRS_SCREENS_DIR = "2026-10-20-p30";

export const prsCounter = (page: Page): Locator => page.getByText(SILO_PRS_COUNTER, { exact: true });

export async function selectPrs(page: Page): Promise<void> {
  await page.getByRole("radiogroup", { name: "Vue" }).getByRole("radio", { name: "PRs" }).click();
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

export const prCard = (page: Page, number: number): Locator =>
  page.getByRole("button", { name: new RegExp(`^PR #${number} · `) });

export const prsCanvas = (page: Page): Locator => page.getByRole("region", { name: "PR ouvertes" });

export const viewRadio = (page: Page, name: "Fonctionnalités" | "PRs"): Locator =>
  page.getByRole("radiogroup", { name: "Vue" }).getByRole("radio", { name });

export type GraphPage = { projectId: string; pageId: string; url: string };

export async function addGraphPage(page: Page, projectId: string, title: string): Promise<GraphPage> {
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const pageId = text(await command({ method: "addPage", title, kind: "view" }), "id");
  await command({ method: "addInstance", pageId, component: "graph@1.0.0" });
  return { projectId, pageId, url: `/#/p/${projectId}/${encodeURIComponent(pageId)}` };
}

export async function deleteGraphPage(page: Page, graph: GraphPage): Promise<void> {
  await rpc(page, {
    method: "command",
    projectId: graph.projectId,
    command: { method: "deletePage", pageId: graph.pageId },
  });
}
