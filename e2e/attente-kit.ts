import type { Page, TestInfo } from "@playwright/test";
import { list, pairBrowser, rpc } from "./agents-seed";
import { kiboCli, loadSilo, type Silo } from "./planning-kit";

export const ATTENTE_SCREENS_DIR = "2026-10-19-p29";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export async function openAttente(page: Page): Promise<Silo> {
  await pairBrowser(page);
  return loadSilo(page);
}

export async function onHoldOf(page: Page, silo: Silo, keyLabel: string): Promise<unknown> {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const ticket = list(snapshot, "tickets").find((t) => field(t, "keyLabel") === keyLabel);
  if (ticket === undefined) throw new Error(`Silo has no ${keyLabel}`);
  return field(ticket, "onHold");
}

export function attenteCli(info: TestInfo, args: readonly string[]): unknown {
  return JSON.parse(kiboCli(info, [...args, "--json"]));
}
