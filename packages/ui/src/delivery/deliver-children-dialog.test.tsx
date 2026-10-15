import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { type DeliveryItem, KiboError, type RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";

const calls: RpcRequest[] = [];
let deliver: (req: RpcRequest) => Promise<unknown> = () => Promise.resolve(null);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return deliver(req);
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { DeliverChildrenDialog } = await import("./DeliverChildrenDialog");

const item = (key: string, patch: Partial<DeliveryItem> = {}): DeliveryItem => ({
  ticketId: `id-${key}`,
  key,
  title: `Titre ${key}`,
  ready: false,
  reason: null,
  blockedBy: [],
  ...patch,
});

const ITEMS: DeliveryItem[] = [
  item("EMIS-18", { reason: "done" }),
  item("EMIS-20", { ready: true }),
  item("EMIS-21", { reason: "status" }),
  item("EMIS-23", { ready: true }),
  item("EMIS-22", { reason: "blocked", blockedBy: ["EMIS-21"] }),
  item("EMIS-24", { reason: "question" }),
  item("EMIS-25", { reason: "busy" }),
];

const parent = { keyLabel: "EMIS-17", title: "C2 · Modèle de données et droits" };

beforeEach(() => {
  calls.length = 0;
  deliver = () => Promise.resolve(null);
});
afterEach(cleanup);

const open = (items = ITEMS, onClose = mock(() => {})) => {
  render(<DeliverChildrenDialog projectId="emis" parent={parent} items={items} onClose={onClose} />);
  return onClose;
};

test("the dialog lists the sub-tickets in delivery order with their state", () => {
  open();
  const dialog = screen.getByRole("dialog", { name: "Livrer les sous-tickets de EMIS-17" });
  expect(within(dialog).getByText(/regroupe 7 sous-tickets/)).toBeTruthy();
  const rows = within(dialog).getAllByRole("listitem");
  expect(rows.map((r) => r.getAttribute("data-key"))).toEqual(ITEMS.map((i) => i.key));
  const state = (key: string) =>
    rows.find((r) => r.getAttribute("data-key") === key)?.querySelector("[data-delivery-state]");
  expect(state("EMIS-18")?.textContent).toBe("livré");
  expect(state("EMIS-20")?.textContent).toBe("prêt");
  expect(state("EMIS-21")?.textContent).toBe("en cours");
  expect(state("EMIS-22")?.textContent).toBe("bloqué par EMIS-21");
  expect(state("EMIS-24")?.textContent).toBe("question bloquante");
  expect(state("EMIS-25")?.textContent).toBe("run en cours");
  expect(within(dialog).getByText("après EMIS-21")).toBeTruthy();
});

test("ready sub-tickets are checked, the others unchecked and disabled", () => {
  open();
  const box = (key: string) => screen.getByRole("checkbox", { name: `${key} Titre ${key}` });
  expect(box("EMIS-20").getAttribute("aria-checked")).toBe("true");
  expect(box("EMIS-23").getAttribute("aria-checked")).toBe("true");
  for (const key of ["EMIS-18", "EMIS-21", "EMIS-22", "EMIS-24", "EMIS-25"]) {
    expect(box(key).getAttribute("aria-checked")).toBe("false");
    expect(box(key).hasAttribute("disabled")).toBe(true);
  }
  expect(screen.getByRole("button", { name: "Livrer 2 tickets" })).toBeTruthy();
});

test("Livrer sends one deliver per checked ticket, in order, then closes", async () => {
  const order: string[] = [];
  deliver = async (req) => {
    if (req.method === "deliver") order.push(req.ticketId);
    await new Promise((r) => setTimeout(r, order.length === 1 ? 20 : 0));
    return null;
  };
  const onClose = open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Livrer 2 tickets" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  expect(order).toEqual(["id-EMIS-20", "id-EMIS-23"]);
  expect(calls).toEqual([
    { method: "deliver", projectId: "emis", ticketId: "id-EMIS-20" },
    { method: "deliver", projectId: "emis", ticketId: "id-EMIS-23" },
  ]);
});

test("unchecking a ready ticket leaves it out", async () => {
  open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("checkbox", { name: "EMIS-20 Titre EMIS-20" }));
  await user.click(screen.getByRole("button", { name: "Livrer 1 ticket" }));
  await waitFor(() => expect(calls).toHaveLength(1));
  expect(calls[0]).toEqual({ method: "deliver", projectId: "emis", ticketId: "id-EMIS-23" });
});

test("a failure stops the sequence and stays open with the reason", async () => {
  deliver = () => Promise.reject(new KiboError("CONFLICT", "busy"));
  const onClose = open();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Livrer 2 tickets" }));
  expect((await screen.findByRole("alert")).textContent).toContain("EMIS-20");
  expect(calls).toHaveLength(1);
  expect(onClose).not.toHaveBeenCalled();
});

test("nothing ready says so with the first reason and disables Livrer", () => {
  open(ITEMS.filter((i) => !i.ready));
  expect(screen.getByText("Rien à livrer : EMIS-18 livré.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "Livrer 0 ticket" }).hasAttribute("disabled")).toBe(true);
});
