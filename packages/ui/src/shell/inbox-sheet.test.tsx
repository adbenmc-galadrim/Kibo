import { beforeEach, expect, mock, test } from "bun:test";
import { INBOX_ID, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { fileSnapshots, fileTargets, inboxSnapshot } from "../inbox/fixtures";

const calls: RpcRequest[] = [];

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return Promise.resolve(req.method === "fileTicket" ? { ticketId: "new-id", key: "KIB-25" } : null);
    },
    subscribe: () => () => undefined,
    subscribeTopic: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
    subscribeEvents: () => () => undefined,
  },
}));

const { TicketSheet } = await import("./TicketSheet");
const { TicketTab } = await import("../pages/TicketTab");
const { ShellDialogs, NO_DIALOG } = await import("./ShellDialogs");

beforeEach(() => {
  calls.length = 0;
});

const noop = () => {};

test("an inbox ticket sheet offers filing instead of an agent", async () => {
  const filed: string[] = [];
  render(
    <TicketSheet
      project={inboxSnapshot}
      ticketId="inb2"
      domains={[]}
      viewer="adam"
      onClose={noop}
      onAssign={noop}
      onFile={() => filed.push("inb2")}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Actions INB-2" }));
  const items = screen.getAllByRole("menuitem").map((m) => m.textContent);
  expect(items).toEqual(["Ouvrir dans un onglet", "Copier la clé", "Rattacher à un projet…", "Supprimer…"]);
  await user.click(screen.getByRole("menuitem", { name: "Rattacher à un projet…" }));
  expect(filed).toEqual(["inb2"]);
});

test("an inbox ticket tab never offers an agent", () => {
  render(
    <TicketTab
      project={inboxSnapshot}
      ticketId="inb2"
      viewer="adam"
      onAssign={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
    />,
  );
  expect(screen.getByRole("heading", { name: "Appeler le comptable" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
});

test("filing from the shell explains the subtree, then opens the sheet on the new ticket", async () => {
  const [a, b, c] = inboxSnapshot.tickets;
  if (!a || !b || !c) throw new Error("fixture");
  const inbox: ProjectSnapshot = {
    ...inboxSnapshot,
    tickets: [a, b, { ...c, parentId: b.id }],
    links: [{ id: "l1", from: a.id, to: b.id, type: "relates" }],
  };
  const patches: unknown[] = [];
  render(
    <ShellDialogs
      state={{ ...NO_DIALOG, fileTicket: { ticketId: b.id } }}
      set={(patch) => patches.push(patch)}
      viewer="adam"
      projects={fileTargets}
      project={null}
      ticketProject={null}
      sheetProject={null}
      snapshots={new Map(fileSnapshots).set(INBOX_ID, inbox)}
      agents={null}
      config={null}
      onOpenTarget={noop}
      onOpenFileTab={noop}
      onCloseProject={noop}
    />,
  );
  const dialog = await screen.findByRole("dialog", { name: "Rattacher INB-2 à un projet" });
  expect(within(dialog).getByText("Ses sous-tickets suivent.")).toBeTruthy();
  expect(within(dialog).getByText(/liens vers d'autres tickets de la boîte sont perdus/)).toBeTruthy();
  await userEvent.setup().click(within(dialog).getByRole("button", { name: "Rattacher" }));
  await waitFor(() =>
    expect(patches).toEqual([{ fileTicket: null, sheet: { projectId: "p1", ticketId: "new-id" } }]),
  );
});
