import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";
import { list, pairBrowser, rpc, text } from "./agents-seed";
import { SILO_PROJECT } from "./fixtures/silo-maquettes";
import { siloPageUrl } from "./pixel-silo";
import { kiboCli, loadSilo, type Silo } from "./planning-kit";

export const ATTENTE_SCREENS_DIR = "2026-10-19-p29";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

export async function openAttente(page: Page): Promise<Silo> {
  await pairBrowser(page);
  return loadSilo(page);
}

async function ticketOf(page: Page, silo: Silo, pick: (ticket: unknown) => boolean): Promise<unknown> {
  const snapshot = await rpc(page, { method: "getProject", projectId: silo.projectId });
  const ticket = list(snapshot, "tickets").find(pick);
  if (ticket === undefined) throw new Error("Silo has no such ticket");
  return ticket;
}

export async function onHoldOf(page: Page, silo: Silo, keyLabel: string): Promise<unknown> {
  return field(await ticketOf(page, silo, (t) => field(t, "keyLabel") === keyLabel), "onHold");
}

export function attenteCli(info: TestInfo, args: readonly string[]): unknown {
  return JSON.parse(kiboCli(info, [...args, "--json"]));
}

export function listedKeys(info: TestInfo, args: readonly string[]): string[] {
  const listed = attenteCli(info, ["tickets", "list", "--project", SILO_PROJECT.key, ...args]);
  return (Array.isArray(listed) ? listed : []).map((t) => String(field(t, "key")));
}

export async function openTicketByKey(page: Page, silo: Silo, keyLabel: string): Promise<Locator> {
  await page.goto(`/#/p/${encodeURIComponent(silo.projectId)}/t/${keyLabel}`);
  const main = page.getByRole("main");
  await expect(main.getByRole("heading").first()).toBeVisible();
  return main;
}

export async function createStepUnder(
  page: Page,
  silo: Silo,
  shortKey: string,
  title: string,
): Promise<string> {
  const feature = await ticketOf(page, silo, (t) => field(t, "shortKey") === shortKey);
  await rpc(page, {
    method: "command",
    projectId: silo.projectId,
    command: { method: "createTicket", title, parentId: text(feature, "id") },
  });
  return text(await ticketOf(page, silo, (t) => field(t, "title") === title), "keyLabel");
}

export async function openAttentePage(page: Page, title: string): Promise<void> {
  await page.goto(await siloPageUrl(page, title));
}

export const heldSection = (page: Page, count: number): Locator =>
  page.getByRole("region", { name: `En attente (${count})`, exact: true });
