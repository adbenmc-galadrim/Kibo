import { expect, test } from "@playwright/test";
import { pairPhone } from "./phone-kit";

const REPLY = "Rien de nouveau depuis le point du jour.";

test("the phone project agent validates the proposed batch and answers a message", async ({ page }) => {
  test.setTimeout(90_000);
  await pairPhone(page);
  await page.getByRole("button", { name: /^Agent de projet · \d+ en attente$/ }).click();
  await expect(page.getByRole("heading", { name: "Agent de projet · Silo" })).toBeVisible();

  const batch = page.getByRole("region", { name: "Lot n° 7" });
  await batch.getByRole("button", { name: "Valider (3)" }).click();
  await expect(batch.getByRole("button", { name: "Valider (3)" })).toHaveCount(0, { timeout: 20_000 });

  await page.getByRole("textbox", { name: "Message à l'agent de projet" }).fill("Où en est F5 ?");
  await page.getByRole("button", { name: "Envoyer" }).click();
  const conversation = page.getByRole("list", { name: "Conversation avec l'agent de projet" });
  await expect(conversation.getByText("Où en est F5 ?")).toBeVisible();
  await expect(conversation.getByText(REPLY)).toBeVisible({ timeout: 60_000 });
});
