import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { rpc, text } from "./agents-seed";

const BY = { kind: "agent", ref: "silo-livraison" } as const;

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

export async function expandQuestion(article: Locator): Promise<Locator> {
  const toggle = article.locator("button[aria-expanded]").first();
  await expect(toggle).toBeVisible();
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  return article;
}

export async function questionLabelOf(article: Locator): Promise<string> {
  const label = await article.getByText(/^Q\d+$/).textContent();
  if (label === null) throw new Error("question without a number");
  return label;
}

export const questionNumber = (label: string): number => Number(label.slice(1));

export async function settled(...targets: Locator[]): Promise<void> {
  for (const target of targets) {
    await expect(target).toBeVisible();
    await target.evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  }
}

export async function openCardMenu(page: Page, article: Locator, label: string): Promise<Locator> {
  await article.getByRole("button", { name: `Actions de ${label}` }).click();
  const menu = page.getByRole("menu");
  await settled(menu);
  return menu;
}

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
