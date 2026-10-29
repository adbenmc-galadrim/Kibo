import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { screensDir } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { loadSilo, type Silo, ticketId } from "./planning-kit";

const KEY = "SILO-51";
const PROFILE = "full-delivery";
const AGENT_TRACES = /Assigner à un agent|^Livrer|Moi \+ agents|full-delivery$/;

test.describe.configure({ mode: "serial" });

let silo: Silo;

async function pageTarget(page: Page, component: string) {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const instance = list(snapshot, "instances").find((i) => text(i, "component") === component);
  return { kind: "page", projectId: silo.projectId, pageId: text(instance, "pageId") };
}

async function ticketTitle(page: Page): Promise<string> {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  return text(
    list(snapshot, "tickets").find((t) => text(t, "keyLabel") === KEY),
    "title",
  );
}

async function assignAgent(page: Page, assignee: { kind: "agent"; ref: string } | null): Promise<void> {
  const id = await ticketId(page, silo, KEY);
  await rpc(page, {
    method: "command",
    projectId: silo.projectId,
    command: { method: "updateTicket", ticketId: id, assignee },
  });
}

async function capture(page: Page, info: TestInfo, name: string): Promise<void> {
  const scheme = info.project.use.colorScheme ?? "light";
  const path = join(screensDir("2026-10-17-r26-traces"), `${name}-${scheme}.png`);
  await page.screenshot({ path, animations: "disabled" });
}

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: 1000 });
  await pairBrowser(page);
  silo = await loadSilo(page);
});

test("execution hidden: no agent trace in the tabs, the sheet, Kanban and the palette", async ({
  page,
}, info) => {
  await assignAgent(page, { kind: "agent", ref: PROFILE });
  const kanban = await pageTarget(page, "kanban@1.0.0");
  const graph = await pageTarget(page, "graph@1.0.0");
  await rpc(page, {
    method: "saveTabs",
    state: {
      tabs: [
        { id: "agents", target: { kind: "screen", screen: "agents" }, pinned: false, preview: false },
        { id: "graph", target: graph, pinned: false, preview: false },
        { id: "kanban", target: kanban, pinned: false, preview: false },
      ],
      activeId: "kanban",
      recents: [],
    },
  });
  try {
    await page.goto(silo.pageUrl("kanban@1.0.0"));
    await page.reload();
    const tabs = page.getByRole("tablist", { name: "Onglets" });
    const card = page.getByRole("article", { name: new RegExp(`^${KEY} `) });
    await expect(card).toBeVisible();
    await capture(page, info, "kanban");
    await expect.soft(tabs.getByRole("tab", { name: /Kanban/ })).toBeVisible();
    await expect.soft(tabs.getByRole("tab", { name: /Graphe/ })).toBeVisible();
    await expect.soft(tabs.getByRole("tab", { name: /^Agents/ })).toHaveCount(0);
    await expect.soft(page.getByText(AGENT_TRACES)).toHaveCount(0);

    await card.getByRole("button", { name: /Actions/ }).click();
    const menu = page.getByRole("menu");
    await expect.soft(menu.getByRole("menuitem", { name: `Copier /full-delivery ${KEY}` })).toBeVisible();
    await expect.soft(menu.getByRole("menuitem", { name: /^Livrer|Assigner/ })).toHaveCount(0);
    await page.keyboard.press("Escape");

    await card.getByRole("button", { name: await ticketTitle(page), exact: true }).click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByRole("combobox", { name: "Assigné" })).toBeVisible();
    await capture(page, info, "fiche");
    await expect.soft(sheet.getByRole("button", { name: `Copier /full-delivery ${KEY}` })).toBeVisible();
    await expect.soft(sheet.getByRole("button", { name: "Assigner à un agent" })).toHaveCount(0);
    await expect.soft(sheet.getByRole("button", { name: /^Livrer/ })).toHaveCount(0);
    await expect.soft(sheet.getByRole("combobox", { name: "Assigné" })).toHaveText("Personne");
    const agentChoice = sheet
      .getByText(/Choisis un profil|full-delivery$/)
      .filter({ hasNotText: "remonté de git, des PR et de full-delivery" });
    await expect.soft(agentChoice).toHaveCount(0);
    await page.keyboard.press("Escape");

    await page.keyboard.press("ControlOrMeta+k");
    const palette = page.getByRole("dialog");
    await palette.getByRole("combobox").fill("agent");
    await capture(page, info, "palette");
    await expect
      .soft(palette.getByRole("option", { name: /^Agents$|Assigner|Files d'attente|Répondre à/ }))
      .toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect.soft(tabs.getByRole("tab", { name: /^Agents/ })).toHaveCount(0);
  } finally {
    await assignAgent(page, null);
  }
});
