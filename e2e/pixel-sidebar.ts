import type { Page } from "@playwright/test";
import { type ContentResult, captureContent } from "./pixel-content";
import type { Scheme } from "./pixel-kit";
import { PROJECT_PAGES_SHIFT, PROJECT_PAGES_ZONE } from "./pixel-masks";

type PagesInput = { screen: string; scheme: Scheme; height: number; outDir: string };

const MARKER = "data-pixel-pages";

export async function captureProjectPages(page: Page, input: PagesInput): Promise<ContentResult> {
  const { x, y, w, h } = PROJECT_PAGES_ZONE;
  await page.evaluate(
    ({ left, top, attribute }) => {
      const marker = document.createElement("div");
      marker.setAttribute(attribute, "");
      marker.style.cssText = `position:fixed;left:${left}px;top:${top}px;width:1px;height:1px;pointer-events:none`;
      document.body.append(marker);
    },
    { left: x, top: y, attribute: MARKER },
  );
  try {
    return await captureContent(page, {
      ...input,
      label: "pages",
      region: { x, y: y + PROJECT_PAGES_SHIFT, w, h: h - PROJECT_PAGES_SHIFT },
      root: page.locator(`[${MARKER}]`),
      masks: [],
    });
  } finally {
    await page.evaluate((attribute) => document.querySelector(`[${attribute}]`)?.remove(), MARKER);
  }
}
