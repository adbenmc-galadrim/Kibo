import { basename } from "node:path";
import { expect, test } from "@playwright/test";
import { macProject, macRpc, macTicket, pairPhone } from "./phone-kit";

const KEY = "SILO-46";
const REASON = "Compte Sentry du client à créer";

const field = (value: unknown, key: string): unknown =>
  typeof value === "object" && value !== null ? Reflect.get(value, key) : undefined;

async function onHold(id: string): Promise<unknown> {
  const tickets = field((await macProject()).snapshot, "tickets");
  const ticket = Array.isArray(tickets) ? tickets.find((t) => field(t, "id") === id) : undefined;
  return field(field(ticket, "onHold"), "reason");
}

test("the phone ticket changes its status, goes on hold and shows its activity, on the Mac", async ({
  page,
}) => {
  const ticket = await macTicket(KEY);
  await pairPhone(page);
  await page.goto(`/#/p/${encodeURIComponent(ticket.projectId)}/t/${encodeURIComponent(ticket.id)}`);
  const sheet = page.getByRole("article", { name: KEY });
  await expect(sheet).toBeVisible();

  await sheet.getByRole("button", { name: `Actions ${KEY}` }).click();
  await page.getByRole("menuitem", { name: "Mettre en attente…" }).click();
  const dialog = page.getByRole("dialog", { name: `Mettre ${KEY} en attente` });
  await dialog.getByRole("textbox", { name: "Raison" }).fill(REASON);
  await dialog.getByRole("button", { name: "Mettre en attente" }).click();
  await expect.poll(() => onHold(ticket.id)).toBe(REASON);

  await sheet.getByRole("combobox", { name: "Statut" }).click();
  await page.getByRole("option", { name: "En cours" }).click();
  await expect.poll(async () => (await macTicket(KEY)).statusId).toBe("in_progress");

  await sheet.getByRole("tab", { name: "Activité" }).click();
  await expect(sheet.getByRole("tabpanel", { name: "Activité" })).toContainText(REASON);
});

async function startableWithoutThread(): Promise<{ key: string; id: string }> {
  const tickets = field((await macProject()).snapshot, "tickets");
  const found = Array.isArray(tickets)
    ? tickets.find((t) => field(t, "startable") === true && field(t, "thread") === null && field(t, "key"))
    : undefined;
  const key = field(found, "key");
  const id = field(found, "id");
  if (typeof key !== "string" || typeof id !== "string") throw new Error("no startable ticket on the Mac");
  return { key, id };
}

test("the phone ticket launches in T3, the thread starts on the Mac and no local path reaches the phone", async ({
  page,
}) => {
  const { projectId, snapshot } = await macProject();
  const folder = field(field(snapshot, "meta"), "folder");
  if (typeof folder !== "string") throw new Error("Silo has no folder on the Mac");
  const target = await startableWithoutThread();
  await pairPhone(page);
  await page.goto(`/#/p/${encodeURIComponent(projectId)}/t/${encodeURIComponent(target.id)}`);
  const sheet = page.getByRole("article", { name: target.key });
  const launch = sheet.getByRole("button", { name: "Lancer dans T3" });
  await expect(launch).toBeEnabled();
  await launch.click();

  const dialog = page.getByRole("dialog", { name: `Lancer ${target.key} dans T3` });
  await expect(dialog).toContainText(`t3 thread start ${basename(folder)}`);
  await expect(dialog).not.toContainText(folder);
  await expect(dialog).not.toContainText("~/");
  await dialog.getByRole("button", { name: "Lancer" }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () =>
      field(await macRpc({ method: "t3.threadOf", projectId, ticketKey: target.key }), "status"),
    )
    .toBe("running");
});
