import { expect, type Page, test } from "@playwright/test";
import { pairAndCreateProject } from "./helpers";
import { E2E_GH_TOKEN, fakeMcpPort } from "./token";

const mcpOf = (baseURL: string | undefined) =>
  `http://127.0.0.1:${fakeMcpPort(Number(new URL(baseURL ?? "").port))}/mcp`;

async function openIntegrations(page: Page) {
  await page.getByRole("button", { name: "Paramètres", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Paramètres" })
    .getByRole("link", { name: "Intégrations" })
    .click();
  await expect(page.getByRole("heading", { name: "Intégrations" })).toBeVisible();
}

function watchLeaks(page: Page): string[] {
  const leaked: string[] = [];
  page.on("response", async (res) => {
    if (!res.url().includes("/api/")) return;
    const body = await res.text().catch((e: unknown) => `unreadable: ${String(e)}`);
    if (body.includes(E2E_GH_TOKEN)) leaked.push(res.url());
  });
  page.on("websocket", (ws) =>
    ws.on("framereceived", ({ payload }) => {
      if (String(payload).includes(E2E_GH_TOKEN)) leaked.push(ws.url());
    }),
  );
  return leaked;
}

test("écran 16, connexion GitHub sans fuite du jeton", async ({ page }, info) => {
  const leaked = watchLeaks(page);
  const key = info.project.name.endsWith("dark") ? "SYD" : "SYL";
  await pairAndCreateProject(page, info, key);
  await openIntegrations(page);
  const row = (title: string) => page.getByRole("main").getByRole("listitem").filter({ hasText: title });
  await expect(row("Git local").getByText("Actif")).toBeVisible();
  await expect(row("Figma").getByRole("button", { name: "Connecter" })).toBeVisible();

  const github = row("PR, reviews, statuts CI");
  await github.getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter GitHub" });
  await dialog.getByRole("radio", { name: "Jeton personnel" }).click();
  await dialog.getByRole("textbox", { name: "Jeton" }).fill(E2E_GH_TOKEN);
  await dialog.getByRole("button", { name: "Connecter" }).click();
  await expect(page.getByText("Connecté en tant que adam")).toBeVisible();
  await expect(github.getByText("compte adam")).toBeVisible();

  expect(leaked).toEqual([]);
});

test("écran 16, serveur MCP HTTP ajouté après confirmation", async ({ page, baseURL }, info) => {
  const url = mcpOf(baseURL);
  await pairAndCreateProject(page, info, info.project.name.endsWith("dark") ? "MCD" : "MCL");
  await openIntegrations(page);
  const mcp = page.getByRole("main").getByRole("listitem").filter({ hasText: "Serveurs MCP" });
  await mcp.getByRole("button", { name: "Connecter" }).click();
  const servers = page.getByRole("dialog", { name: "Serveurs MCP" });
  await expect(servers.getByText("Aucun serveur MCP.")).toBeVisible();
  await servers.getByRole("button", { name: "Ajouter un serveur" }).click();

  const form = page.getByRole("dialog", { name: "Ajouter un serveur MCP" });
  await form.getByRole("textbox", { name: "Nom" }).fill("Faux MCP");
  await form.getByRole("radio", { name: "Adresse HTTP" }).click();
  await form.getByRole("textbox", { name: "Adresse" }).fill(url);
  await form.getByRole("button", { name: "Continuer" }).click();

  const confirm = page.getByRole("dialog", { name: "Confirmer la commande" });
  await expect(confirm.getByText(url)).toBeVisible();
  await confirm.getByRole("button", { name: "Ajouter et lancer" }).click();

  const row = servers.getByRole("listitem").filter({ hasText: "Faux MCP" });
  await expect(row.getByText(/HTTP · \d+ outils$/)).toBeVisible();
  await expect(row.getByText("Actif")).toBeVisible();
});
