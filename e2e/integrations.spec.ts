import { expect, type Page, test } from "@playwright/test";
import { createPage, pairAndCreateProject } from "./helpers";
import { E2E_GH_TOKEN, fakeGithubPort, fakeMcpPort } from "./token";

const auth = { authorization: `Bearer ${E2E_GH_TOKEN}`, "content-type": "application/json" };
const githubOf = (baseURL: string | undefined) =>
  `http://127.0.0.1:${fakeGithubPort(Number(new URL(baseURL ?? "").port))}`;

const mcpOf = (baseURL: string | undefined) =>
  `http://127.0.0.1:${fakeMcpPort(Number(new URL(baseURL ?? "").port))}/mcp`;

type Issue = { number: number; title: string };

const isIssue = (v: unknown): v is Issue =>
  typeof v === "object" &&
  v !== null &&
  "number" in v &&
  typeof v.number === "number" &&
  "title" in v &&
  typeof v.title === "string";

async function issueOf(res: Response): Promise<Issue> {
  const body: unknown = await res.json();
  if (!isIssue(body)) throw new Error(`unexpected issue: ${JSON.stringify(body)}`);
  return body;
}

async function ghIssues(gh: string): Promise<Issue[]> {
  const res = await fetch(`${gh}/repos/adam/kibo/issues?state=all&per_page=100`, { headers: auth });
  const body: unknown = await res.json();
  if (!Array.isArray(body) || !body.every(isIssue))
    throw new Error(`unexpected issues: ${JSON.stringify(body)}`);
  return body;
}

async function ghCreate(gh: string, title: string): Promise<number> {
  const res = await fetch(`${gh}/repos/adam/kibo/issues`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({ title }),
  });
  return (await issueOf(res)).number;
}

async function ghRename(gh: string, n: number, title: string): Promise<void> {
  const res = await fetch(`${gh}/repos/adam/kibo/issues/${n}`, {
    method: "PATCH",
    headers: auth,
    body: JSON.stringify({ title }),
  });
  expect(res.ok).toBe(true);
}

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

test("écran 16, connexion GitHub, Kanban synchronisé aller-retour", async ({ page, baseURL }, info) => {
  const gh = githubOf(baseURL);
  const leaked = watchLeaks(page);
  const key = info.project.name.endsWith("dark") ? "SYD" : "SYL";
  await pairAndCreateProject(page, info, key);
  await openIntegrations(page);
  const row = (title: string) => page.getByRole("main").getByRole("listitem").filter({ hasText: title });
  await expect(row("Git local").getByText("Actif")).toBeVisible();
  await expect(row("Figma (MCP)").getByRole("button", { name: "Connecter" })).toBeVisible();

  const github = row("PR, reviews, statuts CI");
  await github.getByRole("button", { name: "Connecter" }).click();
  const dialog = page.getByRole("dialog", { name: "Connecter GitHub" });
  await dialog.getByRole("radio", { name: "Jeton personnel" }).click();
  await dialog.getByRole("textbox", { name: "Jeton" }).fill(E2E_GH_TOKEN);
  await dialog.getByRole("button", { name: "Connecter" }).click();
  await expect(page.getByText("Connecté en tant que adam")).toBeVisible();
  await expect(github.getByText("compte adam")).toBeVisible();

  const imported = "Issue e2e";
  const n = await ghCreate(gh, imported);

  await page.getByRole("button", { name: `Kibo ${key}`, exact: true }).click();
  await createPage(page, "Kanban GitHub", "Vue");
  await page.getByRole("button", { name: "Ajouter un composant" }).click();
  await page.getByRole("radio", { name: "Kanban", exact: true }).click();
  await page.getByRole("radio", { name: "Synchronisée · GitHub Issues" }).click();
  await page.getByRole("radio", { name: "adam/kibo" }).click();
  await page.getByRole("button", { name: "Ajouter et synchroniser" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await expect(page.getByText("GitHub · adam/kibo")).toBeVisible();
  await expect(page.getByText(imported)).toBeVisible();

  const local = "Ticket e2e";
  await page.getByRole("button", { name: "Nouveau ticket dans À faire", exact: true }).click();
  await page.getByLabel("Titre", { exact: true }).fill(local);
  await page.getByRole("button", { name: "Créer le ticket" }).click();
  await expect(page.getByText(local)).toBeVisible();
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect.poll(async () => (await ghIssues(gh)).some((i) => i.title === local)).toBe(true);

  const renamed = "Renommée e2e";
  await ghRename(gh, n, renamed);
  await page.getByRole("button", { name: "Synchroniser" }).click();
  await expect(page.getByText(renamed)).toBeVisible();

  await page.getByText(renamed).click();
  await expect(page.getByRole("link", { name: `#${n}` })).toBeVisible();

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
