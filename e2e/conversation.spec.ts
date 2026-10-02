import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { rpc, runState, text } from "./agents-seed";
import { E2E_TOKEN } from "./token";

test.setTimeout(120_000);
test.use({ viewport: { width: 1440, height: 900 } });

async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), fullPage: true });
}

async function seed(page: Page) {
  const projectId = text(
    await rpc(page, { method: "createProject", name: "Kibo", key: "KIB", folder: null, color: "#F97316" }),
    "id",
  );
  const command = (cmd: Record<string, unknown>) => rpc(page, { method: "command", projectId, command: cmd });
  const board = text(await command({ method: "addPage", title: "Kanban", kind: "view" }), "id");
  await command({ method: "addInstance", pageId: board, component: "kanban@1.0.0" });
  const ticketId = text(
    await command({ method: "createTicket", title: "Récepteur de hooks", statusId: "todo" }),
    "id",
  );
  const profile = await rpc(page, {
    method: "config",
    command: {
      method: "createProfile",
      profile: {
        name: "opus-dev",
        model: "opus",
        execution: "cli",
        permissionMode: "acceptEdits",
        workspace: "isolated",
        subagents: [],
        maxParallel: 2,
      },
    },
  });
  await rpc(page, { method: "assignAgent", projectId, ticketId, profileId: text(profile, "id"), brief: "" });
  return { projectId, board };
}

test("conversation avec un run terminé, puis passage en review à la demande", async ({ page }, info) => {
  await page.goto(`/#pair=${E2E_TOKEN}`);
  await expect(page.getByRole("button", { name: "Vue d'ensemble" })).toBeVisible();
  const { projectId, board } = await seed(page);
  await expect.poll(() => runState(page, "KIB-1"), { timeout: 20_000 }).toBe("done");

  await page.goto(`/#/p/${projectId}/${encodeURIComponent(board)}`);
  const doing = page.getByRole("region", { name: "En cours" });
  await expect(doing.getByRole("article").filter({ hasText: "KIB-1" })).toBeVisible();
  await page.getByRole("button", { name: "Déplier les agents" }).click();
  await page
    .getByRole("navigation", { name: "Runs" })
    .getByRole("button", { name: /opus-dev-1/ })
    .click();
  const journal = page.getByRole("list", { name: "Journal de opus-dev-1" });
  await expect(journal.getByText("Veux-tu que j'ajoute des tests ?")).toBeVisible();
  await expect(page.getByText("Écrire à l'agent")).toBeVisible();
  await expect(page.getByRole("button", { name: "Passer en review" })).toBeVisible();
  await shot(page, info, "run-termine");

  const field = page.getByLabel("Écrire à opus-dev-1");
  await field.fill("Oui, ajoute les tests du récepteur.");
  await page.getByRole("button", { name: "Envoyer" }).click();
  await expect(field).toBeDisabled();
  await expect(
    page.getByText("L'agent travaille : écris-lui à la fin de son tour, ou arrête-le."),
  ).toBeVisible();
  await shot(page, info, "tour-en-cours");

  await expect(journal.getByText("Tout passe.")).toBeVisible({ timeout: 30_000 });
  await expect(field).toBeEnabled();
  await expect(journal.getByText("Oui, ajoute les tests du récepteur.")).toBeVisible();
  expect(await runState(page, "KIB-1")).toBe("done");
  await expect(doing.getByRole("article").filter({ hasText: "KIB-1" })).toBeVisible();
  await shot(page, info, "journal-echange");

  await page.getByRole("button", { name: "Passer en review" }).click();
  const review = page.getByRole("region", { name: "En review" });
  await expect(review.getByRole("article").filter({ hasText: "KIB-1" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Passer en review" })).toBeHidden();
});
