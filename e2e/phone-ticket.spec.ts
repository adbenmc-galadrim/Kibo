import { expect, test } from "@playwright/test";
import { macProject, macTicket, pairPhone } from "./phone-kit";

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

test.fixme(
  "the phone ticket launches in T3 through the fake t3 (blocked: the Mac sends meta.folder null)",
  () => {},
);
