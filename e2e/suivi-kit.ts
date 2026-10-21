import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { pairBrowser } from "./agents-seed";
import { SILO_PROJECT } from "./fixtures/silo-maquettes";
import { FIXED_NOW, PIXEL_WIDTH } from "./pixel-settings";
import { siloPageUrl } from "./pixel-silo";
import { kiboCli, loadSilo, type Silo } from "./planning-kit";
import { field } from "./record-field";

export { field };

export const SUIVI_HEIGHT = 1260;

export async function openSilo(page: Page): Promise<Silo> {
  await page.setViewportSize({ width: PIXEL_WIDTH, height: SUIVI_HEIGHT });
  await page.clock.setFixedTime(FIXED_NOW);
  await pairBrowser(page);
  return loadSilo(page);
}

export async function openSiloPage(page: Page, title: string): Promise<void> {
  await page.goto(await siloPageUrl(page, title));
}

export const projectAgentPanel = (page: Page): Locator =>
  page.getByRole("dialog", { name: `Agent de projet · ${SILO_PROJECT.name}` });

export async function openProjectAgent(page: Page): Promise<Locator> {
  await page.getByRole("button", { name: /^Agent de projet/ }).click();
  const panel = projectAgentPanel(page);
  await expect(panel).toBeVisible();
  return panel;
}

export const agentList = (panel: Locator): Locator => panel.getByRole("navigation", { name: "Agents" });

export async function openAgentList(panel: Locator): Promise<Locator> {
  await panel.getByRole("button", { name: "Liste des agents", exact: true }).click();
  const nav = agentList(panel);
  await expect(nav).toBeVisible();
  return nav;
}

export async function sayToAgent(panel: Locator, message: string): Promise<void> {
  await panel.getByRole("combobox", { name: "Message à l'agent de projet" }).fill(message);
  await panel.getByRole("button", { name: "Envoyer" }).click();
}

export const userBubbles = (panel: Locator, text: string): Locator =>
  panel.getByRole("listitem", { name: /^Toi · / }).filter({ hasText: text });

export const ticketRow = (page: Page, keyLabel: string): Locator =>
  page
    .getByRole("listitem")
    .filter({ has: page.getByText(keyLabel, { exact: true }) })
    .last();

export function sprintFeatures(info: TestInfo, code: string): readonly string[] {
  const sprints: unknown = JSON.parse(
    kiboCli(info, ["sprints", "list", "--project", SILO_PROJECT.key, "--json"]),
  );
  const found = Array.isArray(sprints) ? sprints.find((s) => s.code === code) : undefined;
  const features: unknown = found?.features;
  return Array.isArray(features) ? features.filter((f): f is string => typeof f === "string") : [];
}
