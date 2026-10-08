import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, INBOX_ID, KiboError, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { inboxMeta } from "../lib/inbox";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);
const snapshots = new Map<string, ProjectSnapshot>();

mock.module("../api", () => ({
  client: {
    rpc: (req: RpcRequest) => {
      calls.push(req);
      return outcome();
    },
  },
}));

const { NewPageDialog } = await import("./NewPageDialog");
const { NewTicketDialog } = await import("./NewTicketDialog");

const fail = () => Promise.reject(new KiboError("INTERNAL", "boom"));

const project: ProjectSnapshot = {
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6", worktree: null },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  questions: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

const inbox: ProjectSnapshot = {
  ...project,
  meta: { id: INBOX_ID, name: "Inbox", key: "INB", folder: null, color: "#64748B", worktree: null },
  nextTicketKey: "INB-4",
};
const shared: ProjectSnapshot = {
  ...project,
  meta: { id: "p2", name: "Portfolio", key: "POR", folder: null, color: "#8B5CF6", worktree: null },
  nextTicketKey: null,
  viewer: "u-adam",
  sync: {
    shared: true,
    keyAllocator: "server",
    role: "owner",
    access: "write",
    members: [
      { userId: "u-adam", name: "Adam", role: "owner" },
      { userId: "u-lea", name: "Léa", role: "editor" },
    ],
  },
};
const kibo: ProjectSnapshot = {
  ...project,
  nextTicketKey: "KIB-25",
  tickets: [
    {
      id: "12@1",
      key: "KIB-12",
      pendingSeq: null,
      keyLabel: "KIB-12",
      title: "Schéma Loro",
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
    },
  ],
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
  snapshots.clear();
  for (const s of [inbox, kibo, shared]) snapshots.set(s.meta.id, s);
});

type User = ReturnType<typeof userEvent.setup>;
const openSelect = async (user: User, name: string) => {
  screen.getByRole("combobox", { name }).focus();
  await user.keyboard("{ArrowDown}");
};
const options = async () => (await screen.findAllByRole("option")).map((o) => o.textContent);
const ticketDialog = (p: Partial<Parameters<typeof NewTicketDialog>[0]> = {}) =>
  render(
    <NewTicketDialog
      projects={[inboxMeta(), kibo.meta, shared.meta]}
      snapshots={snapshots}
      initialProjectId="p1"
      lockProject={false}
      viewer="adam"
      defaults={{}}
      onClose={() => {}}
      {...p}
    />,
  );
const created = () => calls.filter((c) => c.method === "command");

test("the project selector lists the inbox first, preselects the given project, and creates there (screen 114)", async () => {
  ticketDialog();
  const user = userEvent.setup();
  expect(screen.getByRole("combobox", { name: "Projet" }).textContent).toBe("Kibo");
  expect(await screen.findByText("Clé KIB-25")).toBeTruthy();
  await openSelect(user, "Projet");
  expect(await options()).toEqual(["Boîte de réception", "Kibo", "Portfolio"]);
  await user.click(screen.getByRole("option", { name: "Boîte de réception" }));
  expect(await screen.findByText("Clé INB-4")).toBeTruthy();
  await user.type(screen.getByLabelText("Titre"), "Appeler le comptable");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() =>
    expect(created()).toEqual([
      {
        method: "command",
        projectId: INBOX_ID,
        command: {
          method: "createTicket",
          title: "Appeler le comptable",
          description: "",
          statusId: "todo",
          parentId: null,
          assignee: { kind: "human", ref: "adam" },
        },
      },
    ]),
  );
});

test("a shared project offers its members as assignees and its key comes at sync", async () => {
  ticketDialog({ initialProjectId: "p2" });
  const user = userEvent.setup();
  expect(await screen.findByText("Clé attribuée à la synchronisation")).toBeTruthy();
  expect(screen.getByRole("combobox", { name: "Assigné" }).textContent).toBe("Moi (adam)");
  await openSelect(user, "Assigné");
  expect(await options()).toEqual(["Personne", "Moi (adam)", "Léa"]);
  await user.click(screen.getByRole("option", { name: "Léa" }));
  await user.type(screen.getByLabelText("Titre"), "Maquette");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() =>
    expect(created().at(-1)).toMatchObject({
      projectId: "p2",
      command: { assignee: { kind: "human", ref: "u-lea" } },
    }),
  );
});

test("me in a shared project is the sync identity, and nobody sends a null assignee", async () => {
  const { unmount } = ticketDialog({ initialProjectId: "p2" });
  const user = userEvent.setup();
  await screen.findByText("Clé attribuée à la synchronisation");
  await user.type(screen.getByLabelText("Titre"), "Moi");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() =>
    expect(created().at(-1)).toMatchObject({ command: { assignee: { kind: "human", ref: "u-adam" } } }),
  );
  unmount();
  ticketDialog();
  await screen.findByText("Clé KIB-25");
  await openSelect(user, "Assigné");
  await user.click(await screen.findByRole("option", { name: "Personne" }));
  await user.type(screen.getByLabelText("Titre"), "Personne");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() => expect(created().at(-1)).toMatchObject({ command: { assignee: null } }));
});

test("a blocked status requires a reason, which is sent with the ticket", async () => {
  ticketDialog();
  const user = userEvent.setup();
  await screen.findByText("Clé KIB-25");
  expect(screen.queryByLabelText("Motif")).toBeNull();
  await openSelect(user, "Statut");
  expect(await options()).toEqual(["Backlog", "À faire", "En cours", "En review", "Bloqué", "Terminé"]);
  await user.click(screen.getByRole("option", { name: "Bloqué" }));
  await user.type(screen.getByLabelText("Titre"), "Attente client");
  const submit = screen.getByRole("button", { name: "Créer le ticket" });
  expect(submit.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Pourquoi ce ticket ne peut pas démarrer.")).toBeTruthy();
  await user.type(screen.getByLabelText("Motif"), "Devis non signé");
  expect(submit.hasAttribute("disabled")).toBe(false);
  await user.click(submit);
  await waitFor(() =>
    expect(created().at(-1)).toMatchObject({
      command: { method: "createTicket", statusId: "blocked", blockedReason: "Devis non signé" },
    }),
  );
});

test("with a parent the project is locked and explained, and the parent is named", async () => {
  ticketDialog({ lockProject: true, defaults: { parentId: "12@1" } });
  expect(screen.queryByRole("combobox", { name: "Projet" })).toBeNull();
  expect(screen.getByText("Projet : Kibo")).toBeTruthy();
  expect(screen.getByText("Un sous-ticket reste dans le projet de son parent.")).toBeTruthy();
  expect((await screen.findByText(/Schéma Loro/)).textContent).toBe("Parent : KIB-12 Schéma Loro");
});

test("opened from an instance, the project is locked and the instance id is sent", async () => {
  ticketDialog({ lockProject: true, defaults: { statusId: "in_progress", instanceId: "i1" } });
  const user = userEvent.setup();
  expect(screen.getByText("Un ticket créé depuis un widget reste dans le projet de sa page.")).toBeTruthy();
  await screen.findByText("Clé KIB-25");
  await user.type(screen.getByLabelText("Titre"), "  Depuis le Kanban ");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  await waitFor(() =>
    expect(created()).toEqual([
      {
        method: "command",
        projectId: "p1",
        instanceId: "i1",
        command: {
          method: "createTicket",
          title: "Depuis le Kanban",
          description: "",
          statusId: "in_progress",
          parentId: null,
          assignee: { kind: "human", ref: "adam" },
        },
      },
    ]),
  );
});

test("NewTicketDialog waits for the project before creating", () => {
  snapshots.delete("p1");
  ticketDialog();
  expect(screen.getByRole("button", { name: "Créer le ticket" }).hasAttribute("disabled")).toBe(true);
});

test("NewTicketDialog shows an alert and stays open when the RPC fails", async () => {
  outcome = fail;
  const onClose = mock(() => {});
  ticketDialog({ onClose });
  const user = userEvent.setup();
  await screen.findByText("Clé KIB-25");
  await user.type(screen.getByLabelText("Titre"), "Sync");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer le ticket.");
  expect(onClose).not.toHaveBeenCalled();
});

test("NewPageDialog offers the page types as described cards", () => {
  render(<NewPageDialog projectId="p1" projectName="Kibo" parentId={null} open onOpenChange={() => {}} />);
  expect(screen.getByText("Dans le projet Kibo.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Tableau de bord" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Un seul composant en plein écran (Kanban, Tickets…).")).toBeTruthy();
});

test("NewPageDialog shows an alert and stays open when the RPC fails", async () => {
  outcome = fail;
  const onOpenChange = mock((_: boolean) => {});
  render(
    <NewPageDialog projectId="p1" projectName="Kibo" parentId={null} open onOpenChange={onOpenChange} />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nom"), "Tableau");
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer la page.");
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("NewPageDialog shows an alert when the daemon returns an invalid page", async () => {
  outcome = () => Promise.resolve({ id: "x" });
  const onOpenChange = mock((_: boolean) => {});
  render(
    <NewPageDialog projectId="p1" projectName="Kibo" parentId={null} open onOpenChange={onOpenChange} />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Nom"), "Tableau");
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer la page.");
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("NewPageDialog offers to suggest pages, closing itself first", async () => {
  const events: string[] = [];
  render(
    <NewPageDialog
      projectId="p1"
      projectName="Kibo"
      parentId={null}
      open
      onOpenChange={(o) => events.push(`open:${o}`)}
      onSuggest={() => events.push("suggest")}
    />,
  );
  await userEvent.setup().click(screen.getByRole("button", { name: "Suggérer des pages" }));
  expect(events).toEqual(["open:false", "suggest"]);
});

test("NewPageDialog hides the suggestion without a handler", () => {
  render(<NewPageDialog projectId="p1" projectName="Kibo" parentId={null} open onOpenChange={() => {}} />);
  expect(screen.queryByRole("button", { name: "Suggérer des pages" })).toBeNull();
});
