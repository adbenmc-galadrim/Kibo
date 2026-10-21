import { expect, type Page, test } from "@playwright/test";
import { capture, questionArticle } from "./questions-kit";
import { openProjectAgent, openSilo, openSiloPage, userBubbles } from "./suivi-kit";

const QUOTA = "Quota par client : 2 Go ou 5 Go ?";
const WAKE_LINE = "Q16 répondue : « 5 Go »";
const AGENT_TEXT = "Q16 répondue : le quota est de 5 Go par client. Je propose :";
const BATCH = "Lot n° 8";

async function answerQuota(page: Page): Promise<void> {
  await openSiloPage(page, "Questions");
  const card = questionArticle(page.getByRole("main"), QUOTA);
  const form = card.getByRole("form", { name: `Répondre à ${QUOTA}` });
  await form.getByRole("textbox", { name: "Votre réponse…" }).fill("5 Go");
  await form.getByRole("button", { name: "Répondre" }).click();
  await expect(form).toBeHidden();
}

test("answering Q16 wakes the project agent, shown in its conversation", async ({ page }, info) => {
  await openSilo(page);
  await answerQuota(page);
  const panel = await openProjectAgent(page);

  await expect(panel.getByText(WAKE_LINE)).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByText(AGENT_TEXT)).toBeVisible({ timeout: 20_000 });
  const batch = panel.getByRole("region", { name: BATCH, exact: true });
  await expect(batch.getByText(/après réveil/)).toBeVisible();
  await expect(batch.getByRole("button", { name: "Valider (1)" })).toBeVisible();
  await expect(panel.getByText("Résumé du jour")).toHaveCount(0);
  await expect(panel.getByRole("tab")).toHaveCount(0);
  await expect(userBubbles(panel, "5 Go")).toHaveCount(0);
  await capture(page, info, "236");
});
