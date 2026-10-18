import { join } from "node:path";
import type { Browser, Page, TestInfo } from "@playwright/test";
import { createGitRepo, pairBrowser, rpc, type Seeded, seedWorkspace, text } from "./agents-seed";

export const WIDE = { width: 1440, height: 900 };

export type Visibility = { page: Page; seeded: Seeded; repo: string };

const theme = (info: TestInfo) => (info.project.name.endsWith("light") ? "light" : "dark");

export async function capture(page: Page, info: TestInfo, screen: string) {
  const path = join(info.project.outputDir, "screens", `ecran-${screen}-${theme(info)}.png`);
  await page.screenshot({ path, animations: "disabled" });
}

export async function openVisibility(browser: Browser, info: TestInfo): Promise<Visibility> {
  const { colorScheme, baseURL } = info.project.use;
  const context = await browser.newContext({ colorScheme, baseURL, viewport: WIDE });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await context.newPage();
  await pairBrowser(page);
  const repo = createGitRepo();
  return { page, repo, seeded: await seedWorkspace(page, repo) };
}

export const ticketOf = (v: Visibility, n: number): string => v.seeded.tickets.get(n) ?? "";

const command = (v: Visibility, cmd: Record<string, unknown>) =>
  rpc(v.page, { method: "command", projectId: v.seeded.projectId, command: cmd });

export async function addViewPage(v: Visibility, title: string, component: string): Promise<string> {
  const pageId = text(await command(v, { method: "addPage", title, kind: "view" }), "id");
  await command(v, { method: "addInstance", pageId, component });
  return pageId;
}

export async function askQuestion(v: Visibility, n: number, title: string, recipient: string | null) {
  const question = await command(v, {
    method: "createQuestion",
    ticketId: ticketOf(v, n),
    title,
    context: "Le formulaire d'inscription garde l'ancien libellé.",
    options: ["Oui", "Non"],
    provisional: "Non",
    createdBy: { kind: "agent", ref: "livraison-opus" },
  });
  if (recipient)
    await command(v, { method: "setQuestionRecipient", questionId: text(question, "id"), recipient });
}

export async function labelChapters(v: Visibility, chapters: readonly (readonly [number, string])[]) {
  for (const [n, chapter] of chapters)
    await command(v, { method: "updateTicket", ticketId: ticketOf(v, n), labels: [`chapitre:${chapter}`] });
}
