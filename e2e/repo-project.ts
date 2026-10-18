import type { Page, TestInfo } from "@playwright/test";
import { openEmptyProject } from "./helpers";

export const projectKey = (base: string, info: TestInfo) =>
  `${base}${info.project.name.endsWith("light") ? "L" : "D"}`;

export async function shot(page: Page, info: TestInfo, name: string) {
  await page.screenshot({ path: info.outputPath(`${name}.png`), animations: "disabled" });
}

export async function createRepoProject(page: Page, name: string, key: string, folder: string) {
  await openEmptyProject(page, name, key, folder);
}
