import { expect, test } from "@playwright/test";
import { offlineBand, pairPhone, switchMacOff, switchMacOn } from "./phone-kit";
import { placeMasks, removeMasks } from "./pixel-kit";
import { MASK_COLOR } from "./pixel-masks";
import { IPHONE_SAFE_AREA, MOCKUP_MASKS, mockupRatio, SNAPSHOT_TIME_MASK } from "./pixel-phone";
import { schemeOf } from "./pixel-screen";
import { FIXED_NOW } from "./pixel-settings";

const MOCKUP_DRIFT_LIMIT = 0.07;

test("the phone Graphe of Silo, Mac off, keeps its frozen look and stays near the mockup", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const scheme = schemeOf(test.info().project.name);
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  const cdp = await pairPhone(page);
  await page.clock.setFixedTime(FIXED_NOW);
  await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: IPHONE_SAFE_AREA });
  await switchMacOff();
  try {
    await page.reload();
    await expect(offlineBand(page)).toBeVisible();
    await expect(page.getByText("se termine aujourd'hui")).toBeVisible();
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    const mask = await placeMasks(page, [SNAPSHOT_TIME_MASK]);
    await expect(page).toHaveScreenshot(`phone-graphe-${scheme}.png`, { mask, maskColor: MASK_COLOR });
    await removeMasks(page);
    const drift = await mockupRatio(page, `proposition-p35-graphe-${scheme}.png`, [
      ...MOCKUP_MASKS,
      SNAPSHOT_TIME_MASK,
    ]);
    expect(drift).toBeLessThan(MOCKUP_DRIFT_LIMIT);
  } finally {
    await switchMacOn();
  }
});
