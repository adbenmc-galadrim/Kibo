import { expect, type Locator, test } from "@playwright/test";
import { SILO_AGENT_PROMPT, SILO_DAY_SUMMARY } from "./fixtures/silo-suivi";
import {
  agentList,
  openAgentList,
  openProjectAgent,
  openSilo,
  openSiloPage,
  projectAgentPanel,
  sayToAgent,
  userBubbles,
} from "./suivi-kit";

test.describe.configure({ mode: "serial" });

const FOLLOW_UP = "Et F5 ?";
const NO_NEWS = "Rien de nouveau depuis le point du jour.";
const DAY_OPENING = SILO_DAY_SUMMARY.split("\n\n")[0] ?? SILO_DAY_SUMMARY;
const NARROW_WIDTH = 341;
const WIDE_WIDTHS = [720, 721];

test.beforeEach(async ({ page }) => {
  await openSilo(page);
  await openSiloPage(page, "Vue d'ensemble");
});

async function widthOf(locator: Locator): Promise<number> {
  const box = await locator.boundingBox();
  if (box === null) throw new Error("the element is not laid out");
  return Math.round(box.width);
}

const isWide = async (panel: Locator): Promise<boolean> => WIDE_WIDTHS.includes(await widthOf(panel));
const button = (panel: Locator, name: string): Locator => panel.getByRole("button", { name, exact: true });
const batches = (panel: Locator): Locator => panel.getByRole("region", { name: /^Lot n° / });

test("the panel is a conversation: Adam's question, the agent's answer and the batch, no Suivi", async ({
  page,
}) => {
  const panel = await openProjectAgent(page);
  await expect(userBubbles(panel, SILO_AGENT_PROMPT)).toHaveCount(1);
  await expect(panel.getByText(DAY_OPENING).first()).toBeVisible();
  await expect(panel.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await expect(panel.getByRole("tab")).toHaveCount(0);
  await expect(button(panel, "Actions de l'agent de projet")).toHaveCount(0);
  await expect(panel.getByText("Résumé du jour")).toHaveCount(0);
  for (const name of ["Liste des agents", "Nouvel agent", "Agrandir", "Fermer le panneau"])
    await expect(button(panel, name)).toBeVisible();
});

test("a message sent while the agent is busy shows at once and stays after the turn", async ({ page }) => {
  const panel = await openProjectAgent(page);
  await expect(panel.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  const answers = panel.getByText(NO_NEWS);
  const before = await answers.count();
  await sayToAgent(panel, FOLLOW_UP);
  const sent = panel.getByRole("listitem", { name: /^Toi/ }).filter({ hasText: FOLLOW_UP });
  await expect(sent).toBeVisible({ timeout: 500 });
  await expect(answers).toHaveCount(before + 1, { timeout: 30_000 });
  await expect(sent).toHaveCount(1);
  await expect(userBubbles(panel, FOLLOW_UP)).toHaveCount(1);
  await expect(userBubbles(panel, SILO_AGENT_PROMPT)).toHaveCount(1);
});

test("Agrandir shows the agent list, which can be hidden; the choice survives a reload", async ({ page }) => {
  const panel = await openProjectAgent(page);
  await expect.poll(() => widthOf(panel)).toBe(NARROW_WIDTH);
  const view = page.locator("[data-view-body]");
  const docked = await widthOf(view);
  await button(panel, "Agrandir").click();
  await expect.poll(() => isWide(panel)).toBe(true);
  expect(await widthOf(view)).toBeGreaterThanOrEqual(docked);
  const list = agentList(panel);
  await expect(list).toBeVisible();
  await expect(list.getByRole("button").first()).toHaveAccessibleName("Nouvel agent");
  const current = list.locator('[aria-current="true"]');
  await expect(current).toContainText(SILO_AGENT_PROMPT);
  await expect(current).toContainText("en cours");

  await button(panel, "Masquer la liste").click();
  await expect(list).toHaveCount(0);
  await page.reload();
  const reloaded = projectAgentPanel(page);
  await expect(reloaded).toBeVisible();
  await expect.poll(() => isWide(reloaded)).toBe(true);
  await expect(agentList(reloaded)).toHaveCount(0);
  await expect(button(reloaded, "Afficher la liste")).toBeVisible();
  await button(reloaded, "Réduire").click();
  await expect.poll(() => widthOf(reloaded)).toBe(NARROW_WIDTH);
});

test("a new agent closes the current one, which opens read-only from the list", async ({ page }) => {
  const panel = await openProjectAgent(page);
  await expect(panel.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await button(panel, "Nouvel agent").click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Nouvel agent", exact: true }).click();
  await expect(batches(panel)).toHaveCount(0);
  const compose = panel.getByRole("combobox", { name: "Message à l'agent de projet" });
  await expect(compose).toHaveAttribute("placeholder", "Demande quelque chose sur Silo…");

  const list = await openAgentList(panel);
  const past = list.getByRole("button", { name: new RegExp(`^${SILO_AGENT_PROMPT}`) });
  await expect(past).toContainText(/\d+ messages?/);
  await past.click();
  await expect(panel.getByText(/^Ancien agent · /)).toBeVisible();
  await expect(panel.getByRole("region", { name: "Lot n° 7" })).toBeVisible();
  await expect(compose).toHaveCount(0);
  await expect(button(panel, "Nouvel agent").last()).toBeVisible();

  await button(panel, "Retour").click();
  await expect(panel.getByText(/^Ancien agent · /)).toHaveCount(0);
  await expect(compose).toBeVisible();
  await expect(batches(panel)).toHaveCount(0);
});
