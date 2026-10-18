import type { Page } from "@playwright/test";
import { EMPTY_TABS } from "../packages/schema/src/index";

export async function leaveAndResetTabs(page: Page): Promise<void> {
  const { origin } = new URL(page.url());
  await page.goto("about:blank");
  const res = await page.request.post(`${origin}/api/rpc`, {
    headers: { origin },
    data: { method: "saveTabs", state: EMPTY_TABS },
  });
  const body: unknown = await res.json();
  if (typeof body !== "object" || body === null || Reflect.get(body, "ok") !== true)
    throw new Error(`saveTabs failed: ${JSON.stringify(body)}`);
}
