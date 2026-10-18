import { expect, type Page } from "@playwright/test";
import { rpc } from "./agents-seed";
import { EMIS_WORKSPACE_NAME } from "./fixtures/emis-maquettes";

const SEED_TIMEOUT_MS = 25_000;

export async function waitForEmisSeed(page: Page): Promise<void> {
  await expect
    .poll(async () => Reflect.get(Object(await rpc(page, { method: "getConfig" })), "workspaceName"), {
      timeout: SEED_TIMEOUT_MS,
    })
    .toBe(EMIS_WORKSPACE_NAME);
}
