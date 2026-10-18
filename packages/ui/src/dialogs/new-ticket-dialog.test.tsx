import { beforeEach, expect, mock, test } from "bun:test";
import {
  DEFAULT_WORKFLOW,
  EMPTY_PROGRESS,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { Toaster } from "@kibo/sdk/ui/sonner";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { apiMock } from "../api-mock";
import { type Host, HostProvider } from "../shell/Host";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

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

const { NewTicketDialog } = await import("./NewTicketDialog");

const ticket = (id: string, key: string, title: string, patch: Partial<TicketView> = {}): TicketView => ({
  id,
  key,
  pendingSeq: null,
  keyLabel: key,
  title,
  description: "",
  statusId: "todo",
  blockedReason: null,
  domainId: null,
  assignee: null,
  parentId: null,
  labels: [],
  externalRefs: [],
  progress: { done: 0, total: 0 },
  waitingOn: [],
  openQuestions: 0,
  startable: false,
  agentProgress: EMPTY_PROGRESS,
  delivery: null,
  sprintId: null,
  optional: false,
  shortKey: null,
  effectiveSprintId: null,
  session: null,
  updatedAt: null,
  feature: null,
  ...patch,
});

const emis: ProjectSnapshot = {
  meta: {
    id: "p1",
    name: "Emis",
    key: "EMIS",
    folder: null,
    color: "#14B8A6",
    worktree: null,
    storybook: null,
    duplication: null,
    delivery: null,
    tracking: null,
    description: null,
    client: null,
  },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [
    ticket("f6", "F6", "Importer les ISO", { shortKey: "F6" }),
    ticket("e7", "EMIS-7", "Socle", { shortKey: "F3", progress: { done: 0, total: 1 } }),
    ticket("e8", "EMIS-8", "Étape du socle", { parentId: "e7" }),
    ticket("e9", "EMIS-9", "Ticket isolé"),
  ],
  links: [],
  questions: [],
  questionRecipients: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "EMIS-12",
  sprints: [],
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

const host: Host & { openTicket: ReturnType<typeof mock> } = {
  openTicket: mock((_id: string) => {}),
  openNewTicket: () => {},
  openAssign: () => {},
  openFile: () => {},
  openView: () => {},
  openTarget: () => {},
  projectId: "p1",
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(ticket("e12", "EMIS-12", "Gabarit Excel"));
  host.openTicket.mockClear();
});

const open = (onClose = () => {}) =>
  render(
    <HostProvider host={host}>
      <NewTicketDialog
        projects={[emis.meta]}
        snapshots={new Map([["p1", emis]])}
        initialProjectId="p1"
        lockProject={false}
        viewer="adam"
        defaults={{}}
        onClose={onClose}
      />
      <Toaster />
    </HostProvider>,
  );

const pickFeature = async (user: ReturnType<typeof userEvent.setup>, name: string) => {
  screen.getByRole("combobox", { name: "Fonctionnalité" }).focus();
  await user.keyboard("{ArrowDown}");
  await user.click(await screen.findByRole("option", { name }));
};
const sent = () => calls.filter((c) => c.method === "command").at(-1);

test("the Fonctionnalité field lists the features by F<n>, then Nouvelle fonctionnalité", async () => {
  open();
  const user = userEvent.setup();
  expect(screen.getByRole("combobox", { name: "Fonctionnalité" }).textContent).toBe("Aucune");
  screen.getByRole("combobox", { name: "Fonctionnalité" }).focus();
  await user.keyboard("{ArrowDown}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual([
    "Aucune",
    "F3 · Socle",
    "F6 · Importer les ISO",
    "Nouvelle fonctionnalité",
  ]);
});

test("a ticket created in a feature is its step, at the end", async () => {
  open();
  const user = userEvent.setup();
  await pickFeature(user, "F6 · Importer les ISO");
  await user.type(screen.getByLabelText("Titre"), "Gabarit Excel");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() =>
    expect(sent()).toMatchObject({
      command: { method: "createTicket", title: "Gabarit Excel", parentId: "f6" },
    }),
  );
});

test("Nouvelle fonctionnalité creates the ticket as a feature, at the root", async () => {
  open();
  const user = userEvent.setup();
  await pickFeature(user, "Nouvelle fonctionnalité");
  await user.type(screen.getByLabelText("Titre"), "Signer un PV");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() => expect(sent()).toMatchObject({ command: { title: "Signer un PV", feature: true } }));
  const command = sent();
  expect(command?.method === "command" && "parentId" in command.command).toBe(false);
});

test("after creation, a toast « EMIS-12 créé » offers to open the ticket", async () => {
  const onClose = mock(() => {});
  open(onClose);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "Gabarit Excel");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() => expect(onClose).toHaveBeenCalled());
  const toastShown = (await screen.findAllByText("EMIS-12 créé")).at(-1)?.closest("[data-sonner-toast]");
  fireEvent.click(
    within(toastShown instanceof HTMLElement ? toastShown : document.body).getByRole("button", {
      name: "Ouvrir",
    }),
  );
  expect(host.openTicket).toHaveBeenCalledWith("e12");
});

const inbox = { ...emis.meta, id: "inbox", key: "INB", name: "Boîte de réception" };

test("the inbox is not offered as a project", async () => {
  render(
    <HostProvider host={host}>
      <NewTicketDialog
        projects={[inbox, emis.meta]}
        snapshots={new Map([["p1", emis]])}
        initialProjectId="p1"
        lockProject={false}
        viewer="adam"
        defaults={{}}
        onClose={() => {}}
      />
    </HostProvider>,
  );
  screen.getByRole("combobox", { name: "Projet" }).focus();
  await userEvent.setup().keyboard("{ArrowDown}");
  expect((await screen.findAllByRole("option")).map((o) => o.textContent)).toEqual(["Emis"]);
});

test("a ticket created from a page says it stays in the project of that page", () => {
  render(
    <HostProvider host={host}>
      <NewTicketDialog
        projects={[emis.meta]}
        snapshots={new Map([["p1", emis]])}
        initialProjectId="p1"
        lockProject
        viewer="adam"
        defaults={{}}
        onClose={() => {}}
      />
    </HostProvider>,
  );
  expect(screen.getByText("Le ticket est créé dans le projet de la page ouverte.")).toBeTruthy();
  expect(screen.queryByText(/widget/)).toBeNull();
});
