import { expect, test } from "@playwright/test";
import { macProject, openTab, pairPhone } from "./phone-kit";

const ANSWERED = "Quota par client : 2 Go ou 5 Go ?";
const ASKED = "Le chef de centre signe-t-il le rapport ?";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function macQuestion(title: string): Promise<unknown> {
  const questions = field((await macProject()).snapshot, "questions");
  return Array.isArray(questions) ? questions.find((q) => field(q, "title") === title) : undefined;
}

test("the phone Questions answer one and ask a new one, both on the Mac", async ({ page }) => {
  await pairPhone(page);
  await openTab(page, "Questions");
  const article = page.getByRole("article", { name: ANSWERED });
  await article.getByRole("button", { name: ANSWERED }).click();
  const form = article.getByRole("form", { name: `Répondre à ${ANSWERED}` });
  await form.getByRole("textbox", { name: "Votre réponse…" }).fill("5 Go, revu chaque trimestre");
  await form.getByRole("button", { name: "Répondre" }).click();
  await expect.poll(async () => field(await macQuestion(ANSWERED), "answer")).not.toBeNull();

  await page.getByRole("button", { name: "Nouvelle question" }).click();
  const dialog = page.getByRole("dialog", { name: "Nouvelle question" });
  await dialog.getByRole("combobox", { name: "Ticket" }).click();
  await page.getByRole("option", { name: "SILO-81 Modèle du rapport" }).click();
  await dialog.getByRole("textbox", { name: "Question" }).fill(ASKED);
  await dialog.getByRole("button", { name: "Créer la question" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("article", { name: ASKED })).toBeVisible();
  await expect.poll(() => macQuestion(ASKED)).toBeTruthy();
});
