import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { rpc, text } from "./agents-seed";

const BY = { kind: "agent", ref: "emis-livraison" } as const;

export const projectIdOf = (page: Page): string => {
  const match = /#\/p\/([^/?]+)\//.exec(page.url());
  if (!match?.[1]) throw new Error(`no project in ${page.url()}`);
  return decodeURIComponent(match[1]);
};

const command = (page: Page, projectId: string, cmd: Record<string, unknown>) =>
  rpc(page, { method: "command", projectId, command: cmd });

export async function seedTicket(page: Page, projectId: string, title: string): Promise<string> {
  return text(await command(page, projectId, { method: "createTicket", title, statusId: "todo" }), "id");
}

export async function seedQuestion(
  page: Page,
  projectId: string,
  ticketId: string,
  title: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const created = await command(page, projectId, {
    method: "createQuestion",
    ticketId,
    title,
    context: "Décision prise **provisoirement** par le run pilote.",
    options: ["Oui", "Non"],
    createdBy: BY,
    ...extra,
  });
  return text(created, "id");
}

export async function seedAnswered(
  page: Page,
  projectId: string,
  ticketId: string,
  title: string,
  answer: string,
  extra: Record<string, unknown> = {},
): Promise<string> {
  const questionId = await seedQuestion(page, projectId, ticketId, title, extra);
  await command(page, projectId, {
    method: "answerQuestion",
    questionId,
    answer: { kind: "option", option: answer },
    by: { kind: "human", ref: "e2e" },
  });
  return questionId;
}

export const questionArticle = (view: Locator, title: string): Locator =>
  view.getByRole("article", { name: title, exact: true });

export const previewCard = (page: Page): Locator => page.locator('[data-slot="hover-card-content"]');

export async function hoverBadge(page: Page, badge: Locator): Promise<Locator> {
  await badge.hover();
  const card = previewCard(page);
  await expect(card).toBeVisible();
  return card;
}

export async function capture(
  page: Page,
  info: TestInfo,
  name: string,
  animations: "allow" | "disabled" = "disabled",
): Promise<void> {
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations });
}
