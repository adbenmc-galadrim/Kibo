import { beforeEach, expect, mock, test } from "bun:test";
import { INBOX_ID, KiboError, type RpcRequest, type TicketView } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { fileSnapshots, fileTargets, inboxSnapshot } from "../inbox/fixtures";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve({ ticketId: "new-id", key: "KIB-25" });

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return outcome();
      },
    },
  }),
);

const { FileTicketDialog } = await import("./FileTicketDialog");

function inboxTicket2(): TicketView {
  const found = inboxSnapshot.tickets[1];
  if (!found) throw new Error("fixture");
  return found;
}
const ticket = inboxTicket2();

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve({ ticketId: "new-id", key: "KIB-25" });
});

type Options = { hasChildren?: boolean; hasLinks?: boolean; onFiled?(p: string, t: string): void };

function renderDialog(o: Options = {}, snapshots = fileSnapshots) {
  return render(
    <FileTicketDialog
      ticket={ticket}
      hasChildren={o.hasChildren ?? false}
      hasLinks={o.hasLinks ?? false}
      projects={fileTargets}
      snapshots={snapshots}
      onClose={() => {}}
      onFiled={o.onFiled ?? (() => {})}
    />,
  );
}

test("files into the chosen editable project, explains the new key, children and lost links, then opens the new ticket (screen 115)", async () => {
  const filed: [string, string][] = [];
  renderDialog({ hasChildren: true, hasLinks: true, onFiled: (p, t) => filed.push([p, t]) });
  expect(screen.getByRole("dialog", { name: "Rattacher INB-2 à un projet" })).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Projet" }).textContent).toBe("Kibo");
  expect(screen.getByText(/la prochaine est KIB-25/)).toBeTruthy();
  expect(screen.getByText("Ses sous-tickets suivent.")).toBeTruthy();
  expect(screen.getByText(/liens vers d'autres tickets de la boîte sont perdus/)).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Rattacher" }));
  await waitFor(() =>
    expect(calls).toEqual([{ method: "fileTicket", ticketId: ticket.id, projectId: "p1" }]),
  );
  await waitFor(() => expect(filed).toEqual([["p1", "new-id"]]));
});

test("a shared target says the key comes from the server; a read-only project is not offered", async () => {
  renderDialog();
  expect(screen.queryByText("Ses sous-tickets suivent.")).toBeNull();
  expect(screen.queryByText(/liens vers d'autres tickets/)).toBeNull();
  const user = userEvent.setup();
  screen.getByRole("combobox", { name: "Projet" }).focus();
  await user.keyboard("{ArrowDown}");
  const options = (await screen.findAllByRole("option")).map((o) => o.textContent);
  expect(options).toEqual(["Kibo", "Portfolio"]);
  await user.click(screen.getByRole("option", { name: "Portfolio" }));
  expect(await screen.findByText("Sa clé sera attribuée par le serveur de sync.")).toBeTruthy();
  expect(screen.queryByText(/la prochaine est/)).toBeNull();
});

test("without an editable project the dialog explains and cannot file", () => {
  renderDialog({}, new Map([[INBOX_ID, inboxSnapshot]]));
  expect(screen.getByText("Aucun projet modifiable : crée un projet d'abord.")).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Projet" })).toBeNull();
  expect(screen.getByRole("button", { name: "Rattacher" }).hasAttribute("disabled")).toBe(true);
});

test("a FORBIDDEN answer is shown in the dialog, which stays open", async () => {
  outcome = () => Promise.reject(new KiboError("FORBIDDEN", "read only"));
  const filed: string[] = [];
  renderDialog({ onFiled: (p) => filed.push(p) });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Rattacher" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Ce projet est en lecture seule pour toi.");
  expect(screen.getByRole("dialog", { name: "Rattacher INB-2 à un projet" })).toBeTruthy();
  expect(filed).toEqual([]);
});
