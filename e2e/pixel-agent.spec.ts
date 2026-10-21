import { expect, test } from "@playwright/test";
import { PIXEL_HEIGHTS, PIXEL_MASKS } from "./pixel-masks";
import { contentBox, measureScreen, screensDir, settlePointer } from "./pixel-screen";
import { openSiloOverviewAgent } from "./pixel-silo";
import { agentList, projectAgentPanel } from "./suivi-kit";

const HEIGHT = PIXEL_HEIGHTS["agent-agrandi"];
const WIDE_LAYOUT: Readonly<Record<string, string>> = {
  "kibo.projectAgent.wide": "1",
  "kibo.projectAgent.list": "1",
};

test("the widened project agent over the Vue d'ensemble of Silo matches the mockup on the whole screen", async ({
  page,
}) => {
  await page.addInitScript((layout) => {
    for (const [key, value] of Object.entries(layout)) localStorage.setItem(key, value);
  }, WIDE_LAYOUT);
  await openSiloOverviewAgent(page, HEIGHT);
  const panel = projectAgentPanel(page);
  await expect(agentList(panel)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Réduire", exact: true })).toBeVisible();
  await settlePointer(page, HEIGHT);
  await measureScreen(page, {
    screen: "agent-agrandi",
    height: HEIGHT,
    masks: PIXEL_MASKS["agent-agrandi"],
    content: contentBox(241, HEIGHT),
    root: (p) => p.locator("[data-view-body]"),
    outDir: screensDir("2026-10-21-p31"),
    contentInformative: true,
  });
});
