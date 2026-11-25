import { type CDPSession, expect, type Locator, type Page, test } from "@playwright/test";
import { phoneServerOf } from "./phone-projects";

const PAIR_TIMEOUT_MS = 30_000;

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

const controlUrl = (path: string): string =>
  `http://127.0.0.1:${phoneServerOf(test.info().project.name).controlPort}${path}`;

async function control(path: string): Promise<unknown> {
  const res = await fetch(controlUrl(path), { method: "POST" });
  if (!res.ok) throw new Error(`phone control ${path} answered ${res.status}`);
  return res.json();
}

async function pairingCode(): Promise<string> {
  const code = field(await control("/pair"), "code");
  if (typeof code !== "string") throw new Error("the Mac returned no pairing code");
  return code;
}

export const switchMacOff = (): Promise<unknown> => control("/mac/off");
export const stallMac = (): Promise<unknown> => control("/mac/stall");
export const switchMacOn = (): Promise<unknown> => control("/mac/on");

export const tabBar = (page: Page): Locator => page.getByRole("navigation", { name: "Écrans du projet" });

export async function addPasskeyAuthenticator(page: Page): Promise<CDPSession> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: {
      protocol: "ctap2",
      transport: "internal",
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
    },
  });
  return cdp;
}

export async function pairPhone(page: Page): Promise<CDPSession> {
  await switchMacOn();
  const cdp = await addPasskeyAuthenticator(page);
  await page.goto("/");
  await page.getByLabel("Coller le code").fill(await pairingCode());
  await page.getByRole("button", { name: "Appairer", exact: true }).click();
  await expect(tabBar(page)).toBeVisible({ timeout: PAIR_TIMEOUT_MS });
  return cdp;
}

export async function openTab(page: Page, name: string): Promise<void> {
  await tabBar(page).getByRole("link", { name }).click();
  await expect(page.getByRole("banner").first()).toContainText(name);
}

export const offlineBand = (page: Page): Locator => page.getByText(/^Mac éteint · dernier état à \d\d:\d\d$/);

export async function macRpc(req: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(controlUrl("/rpc"), { method: "POST", body: JSON.stringify(req) });
  if (!res.ok) throw new Error(`mac rpc ${String(req.method)} answered ${res.status}`);
  return res.json();
}

export type MacTicket = { id: string; key: string; statusId: string; title: string; projectId: string };

const SILO_KEY = "SILO";

export async function siloProjectId(): Promise<string> {
  const projects = await macRpc({ method: "listProjects" });
  const silo = Array.isArray(projects) ? projects.find((p) => field(p, "key") === SILO_KEY) : undefined;
  const id = field(silo, "id");
  if (typeof id !== "string") throw new Error("Silo is not on the Mac");
  return id;
}

export async function macProject(): Promise<{ projectId: string; snapshot: unknown }> {
  const projectId = await siloProjectId();
  return { projectId, snapshot: await macRpc({ method: "getProject", projectId }) };
}

export async function macTicket(key: string): Promise<MacTicket> {
  const { projectId, snapshot } = await macProject();
  const tickets = field(snapshot, "tickets");
  const found = Array.isArray(tickets) ? tickets.find((t) => field(t, "key") === key) : undefined;
  const id = field(found, "id");
  const statusId = field(found, "statusId");
  const title = field(found, "title");
  if (typeof id !== "string" || typeof statusId !== "string" || typeof title !== "string")
    throw new Error(`${key} is not on the Mac`);
  return { id, key, statusId, title, projectId };
}

export const macTitles = async (): Promise<string[]> => {
  const tickets = field((await macProject()).snapshot, "tickets");
  return Array.isArray(tickets) ? tickets.map((t) => String(field(t, "title"))) : [];
};

export const noPageScroll = (page: Page): Promise<boolean> =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
