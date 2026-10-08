import { expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  type ProjectCommand,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TicketCommand } from "./use-ticket-command";

const calls: RpcRequest[] = [];
mock.module("../api", () => ({
  client: {
    rpc: async (req: RpcRequest) => {
      calls.push(req);
      if (req.method === "getSyncState") return { bindings: [], pending: [], errors: [] };
      if (req.method === "getPresence") return [];
      return null;
    },
    subscribe: () => () => undefined,
    subscribeEvents: () => () => undefined,
    subscribeIntegrations: () => () => undefined,
  },
}));

const { LabelsField } = await import("./LabelsField");
const { TicketSheet } = await import("../shell/TicketSheet");
const { TicketTab } = await import("../pages/TicketTab");

const ticket = (patch: Partial<TicketView> = {}): TicketView => ({
  id: "12@1",
  key: "KIB-12",
  pendingSeq: null,
  keyLabel: "KIB-12",
  title: "Schéma Loro des tickets",
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: ["phase:p1", "urgent"],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  ...patch,
});

const fakeCommand = (error: string | null = null) => {
  const sent: ProjectCommand[] = [];
  const command: TicketCommand = {
    run: async (c) => {
      sent.push(c);
      return true;
    },
    error,
    busy: false,
    clearError: () => {},
  };
  return { sent, command };
};

test("adds a label with Enter and removes one with its cross", async () => {
  const { sent, command } = fakeCommand();
  render(<LabelsField ticket={ticket()} editable command={command} />);
  expect(screen.getByText("phase:p1")).toBeTruthy();
  expect(screen.getByText("urgent")).toBeTruthy();
  await userEvent.type(screen.getByRole("textbox", { name: "Ajouter une étiquette" }), "area:api{Enter}");
  expect(sent).toEqual([
    { method: "updateTicket", ticketId: "12@1", labels: ["area:api", "phase:p1", "urgent"] },
  ]);
  await userEvent.click(screen.getByRole("button", { name: "Retirer l'étiquette urgent" }));
  expect(sent[1]).toEqual({ method: "updateTicket", ticketId: "12@1", labels: ["phase:p1"] });
});

test("refuses an invalid label without sending anything", async () => {
  const { sent, command } = fakeCommand();
  render(<LabelsField ticket={ticket()} editable command={command} />);
  const field = screen.getByRole("textbox", { name: "Ajouter une étiquette" });
  await userEvent.type(field, "Bad{Enter}");
  expect(screen.getByRole("alert").textContent).toBe(
    "Étiquette invalide : minuscules, chiffres, : _ . / -, 40 caractères.",
  );
  expect(field.getAttribute("aria-invalid")).toBe("true");
  expect(sent).toEqual([]);
});

test("a label already on the ticket is not sent again", async () => {
  const { sent, command } = fakeCommand();
  render(<LabelsField ticket={ticket()} editable command={command} />);
  await userEvent.type(screen.getByRole("textbox", { name: "Ajouter une étiquette" }), "urgent{Enter}");
  expect(sent).toEqual([]);
});

test("shows the command error", () => {
  const { command } = fakeCommand("Action refusée.");
  render(<LabelsField ticket={ticket()} editable command={command} />);
  expect(screen.getByRole("alert").textContent).toBe("Action refusée.");
});

test("read-only shows the chips only, and nothing without labels", () => {
  const { command } = fakeCommand();
  const { container, rerender } = render(
    <LabelsField ticket={ticket()} editable={false} command={command} />,
  );
  expect(screen.getByText("urgent")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.queryByRole("button")).toBeNull();
  rerender(<LabelsField ticket={ticket({ labels: [] })} editable={false} command={command} />);
  expect(container.textContent).toBe("");
});

const project = (main: TicketView): ProjectSnapshot => ({
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [main],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-13",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
});

const showSheet = (main: TicketView) =>
  render(
    <TicketSheet
      project={project(main)}
      ticketId={main.id}
      domains={[]}
      viewer="adam"
      onClose={() => {}}
      onAssign={() => {}}
      onOpenInTab={() => {}}
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
      onDeleted={() => {}}
    />,
  );

test("the sheet shows the labels under the title and the import origin on hover", async () => {
  showSheet(ticket({ externalRefs: [{ kind: "import_ref", source: "plan", id: "C0-9" }] }));
  const title = await screen.findByRole("heading", { name: "Schéma Loro des tickets" });
  expect(title.getAttribute("title")).toBe("Importé de plan · C0-9");
  const chips = screen.getByRole("group", { name: "Étiquettes" });
  expect(chips.textContent).toContain("phase:p1");
  expect(title.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("the sheet title has no hover text without an import", async () => {
  showSheet(ticket());
  const title = await screen.findByRole("heading", { name: "Schéma Loro des tickets" });
  expect(title.getAttribute("title")).toBeNull();
});

test("the ticket tab shows the labels under the title", async () => {
  const main = ticket();
  render(
    <TicketTab
      project={project(main)}
      ticketId={main.id}
      viewer="adam"
      onOpenFile={() => {}}
      onOpenTicket={() => {}}
    />,
  );
  const title = await screen.findByRole("heading", { name: "Schéma Loro des tickets" });
  const chips = screen.getByRole("group", { name: "Étiquettes" });
  expect(chips.textContent).toContain("urgent");
  expect(title.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
