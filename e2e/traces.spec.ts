import { join } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { screensDir } from "./pixel-screen";
import { PIXEL_WIDTH } from "./pixel-settings";
import { type Emis, loadEmis, ticketId } from "./planning-kit";

const KEY = "EMIS-51";
const PROFILE = "full-delivery";
const AGENT_TRACES = /Assigner à un agent|^Livrer|Moi \+ agents|full-delivery$/;

test.describe.configure({ mode: "serial" });

let emis: Emis;

async function pageTarget(page: Page, component: string) {
  const snapshot = await rpc(page, { method: "getProject", projectId: emis.projectId });
  const instance = list(snapshot, "instances").find((i) => text(i, "component") === component);
  return { kind: "page", projectId: emis.projectId, pageId: text(instance, "pageId") };
}

async function ticketTitle(page: Page): Promise<string> {
  const snapshot = await rpc(page, { method: "getProject", projectId: emis.projectId });
  return text(
    list(snapshot, "tickets").find((t) => text(t, "keyLabel") === KEY),
    "title",
  );
}

async function assignAgent(page: Page, assignee: { kind: "agent"; ref: string } | null): Promise<void> {
  const id = await ticketId(page, emis, KEY);
  await rpc(page, {
    method: "command",
    projectId: emis.projectId,
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
  emis = await loadEmis(page);
});

test("execution hidden: no agent trace in the tabs, the sheet, Kanban, Tickets and the palette", async ({
  page,
}, info) => {
  await assignAgent(page, { kind: "agent", ref: PROFILE });
  const kanban = await pageTarget(page, "kanban@1.0.0");
  const tickets = await pageTarget(page, "tickets@1.0.0");
  await rpc(page, {
    method: "saveTabs",
    state: {
      tabs: [
        { id: "agents", target: { kind: "screen", screen: "agents" }, pinned: false, preview: false },
        { id: "tickets", target: tickets, pinned: false, preview: false },
        { id: "kanban", target: kanban, pinned: false, preview: false },
      ],
      activeId: "kanban",
      recents: [],
    },
  });
  try {
    await page.goto(emis.pageUrl("kanban@1.0.0"));
    await page.reload();
    const tabs = page.getByRole("tablist", { name: "Onglets" });
    const card = page.getByRole("article", { name: new RegExp(`^${KEY} `) });
    await expect(card).toBeVisible();
    await capture(page, info, "kanban");
    await expect.soft(tabs.getByRole("tab", { name: /Kanban/ })).toBeVisible();
    await expect.soft(tabs.getByRole("tab", { name: /Tickets/ })).toBeVisible();
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

    await page.goto(emis.pageUrl("tickets@1.0.0"));
    await expect(page.locator("[data-row-title]").first()).toBeVisible();
    await page.getByRole("button", { name: "Ouverts" }).click();
    await capture(page, info, "tickets");
    await expect(page.getByRole("menuitemradio", { name: "Moi" })).toBeVisible();
    await expect(page.getByRole("menuitemradio", { name: "Tous" })).toBeVisible();
    await expect.soft(page.getByRole("menuitemradio", { name: "Agents" })).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect.soft(page.getByText(AGENT_TRACES)).toHaveCount(0);

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
