import { beforeEach, expect, mock, test } from "bun:test";
import { INBOX_ID, type RpcRequest } from "@kibo/schema";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { fileTargets, inboxSnapshot } from "./fixtures";

const calls: RpcRequest[] = [];

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return Promise.resolve(null);
      },
    },
  }),
);

const { InboxPage } = await import("./InboxPage");

beforeEach(() => {
  calls.length = 0;
});

type Handlers = { onOpenTicket?(id: string): void; onNewTicket?(): void; onFile?(id: string): void };

function renderPage(h: Handlers = {}, snapshot = inboxSnapshot) {
  return render(
    <InboxPage
      snapshot={snapshot}
      projects={fileTargets}
      viewer="adam"
      onOpenTicket={h.onOpenTicket ?? (() => {})}
      onNewTicket={h.onNewTicket ?? (() => {})}
      onFile={h.onFile ?? (() => {})}
    />,
  );
}

const labels = () => screen.getAllByRole("menuitem").map((m) => m.textContent);

test("lists inbox tickets with status and assignee, opens on click, and offers the same menu on ⋯ and right click (screen 113)", async () => {
  const opened: string[] = [];
  const filed: string[] = [];
  renderPage({ onOpenTicket: (id) => opened.push(id), onFile: (id) => filed.push(id) });
  expect(screen.getByRole("heading", { level: 1, name: "Boîte de réception" })).toBeTruthy();
  expect(screen.getAllByRole("row")).toHaveLength(4);
  const row = screen.getByRole("row", { name: /INB-2/ });
  expect(within(row).getByText("À faire")).toBeTruthy();
  expect(within(row).getByText("adam")).toBeTruthy();
  expect(within(screen.getByRole("row", { name: /INB-1/ })).getByText("—")).toBeTruthy();
  fireEvent.click(within(row).getByRole("button", { name: /Appeler le comptable/ }));
  expect(opened).toEqual(["inb2"]);
  fireEvent.click(within(row).getByRole("button", { name: "Rattacher…" }));
  expect(filed).toEqual(["inb2"]);
  const user = userEvent.setup();
  await user.click(within(row).getByRole("button", { name: "Actions pour INB-2" }));
  expect(labels()).toEqual(["Ouvrir", "Rattacher à un projet…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Rattacher à un projet…" }));
  expect(filed).toEqual(["inb2", "inb2"]);
  fireEvent.contextMenu(screen.getByRole("row", { name: /INB-3/ }));
  expect(labels()).toEqual(["Ouvrir", "Rattacher à un projet…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Ouvrir" }));
  expect(opened).toEqual(["inb2", "inb3"]);
});

test("the empty state explains and offers a new ticket", () => {
  let asked = 0;
  renderPage({ onNewTicket: () => asked++ }, { ...inboxSnapshot, tickets: [] });
  expect(screen.getByText("Rien en attente.")).toBeTruthy();
  expect(screen.getByText("Les tickets créés sans projet arrivent ici.")).toBeTruthy();
  expect(screen.queryByRole("table")).toBeNull();
  const buttons = screen.getAllByRole("button", { name: "Nouveau ticket" });
  for (const b of buttons) fireEvent.click(b);
  expect(asked).toBe(2);
});

test("removing asks for confirmation then sends deleteTicket on the inbox", async () => {
  renderPage();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions pour INB-2" }));
  await user.click(screen.getByRole("menuitem", { name: "Supprimer…" }));
  const dialog = await screen.findByRole("alertdialog", { name: "Supprimer INB-2 ?" });
  expect(calls).toEqual([]);
  await user.click(within(dialog).getByRole("button", { name: "Supprimer" }));
  await waitFor(() =>
    expect(calls).toEqual([
      { method: "command", projectId: INBOX_ID, command: { method: "deleteTicket", ticketId: "inb2" } },
    ]),
  );
});
