import { beforeEach, expect, mock, test } from "bun:test";
import { DEFAULT_WORKFLOW, KiboError, type ProjectSnapshot, type RpcRequest } from "@kibo/schema";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const calls: RpcRequest[] = [];
let outcome: () => Promise<unknown> = () => Promise.resolve(null);

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
  meta: { id: "p1", name: "Kibo", key: "KIB", folder: null, color: "#14B8A6" },
  workflow: DEFAULT_WORKFLOW,
  pages: [],
  tickets: [],
  links: [],
  instances: [],
  rules: [],
  bindings: [],
  nextTicketKey: "KIB-1",
  sync: { shared: false, keyAllocator: "local", role: null, access: "write", members: [] },
};

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("NewTicketDialog announces the key the ticket will get", () => {
  render(
    <NewTicketDialog
      project={{ ...project, nextTicketKey: "KIB-30" }}
      viewer="adam"
      defaults={{}}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Kibo · la clé KIB-30 sera attribuée à la création.")).toBeTruthy();
});

test("NewTicketDialog explains that the key comes with the next sync", () => {
  render(
    <NewTicketDialog
      project={{ ...project, nextTicketKey: null }}
      viewer="adam"
      defaults={{}}
      onClose={() => {}}
    />,
  );
  expect(screen.getByText("Kibo · la clé sera attribuée à la prochaine synchronisation.")).toBeTruthy();
});

test("NewTicketDialog opened from an instance sends its id with the command", async () => {
  render(
    <NewTicketDialog
      project={project}
      viewer="adam"
      defaults={{ statusId: "todo", instanceId: "i1" }}
      onClose={() => {}}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "Depuis le Kanban");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  expect(calls).toHaveLength(1);
  expect(calls[0]).toMatchObject({ method: "command", projectId: "p1", instanceId: "i1" });
});

test("NewPageDialog offers the page types as described cards", () => {
  render(<NewPageDialog projectId="p1" projectName="Kibo" parentId={null} open onOpenChange={() => {}} />);
  expect(screen.getByText("Dans le projet Kibo.")).toBeTruthy();
  expect(screen.getByRole("radio", { name: "Tableau de bord" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByText("Un seul composant en plein écran (Kanban, Tickets…).")).toBeTruthy();
});

test("NewTicketDialog creates the ticket with the defaults then closes", async () => {
  const onClose = mock(() => {});
  render(
    <NewTicketDialog
      project={project}
      viewer="adam"
      defaults={{ statusId: "in_progress" }}
      onClose={onClose}
    />,
  );
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "  Arbre des pages ");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "createTicket",
        title: "Arbre des pages",
        description: "",
        statusId: "in_progress",
        parentId: null,
        assignee: { kind: "human", ref: "adam" },
      },
    },
  ]);
  expect(onClose).toHaveBeenCalled();
});

test("NewTicketDialog shows an alert and stays open when the RPC fails", async () => {
  outcome = fail;
  const onClose = mock(() => {});
  render(<NewTicketDialog project={project} viewer="adam" defaults={{}} onClose={onClose} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "Sync");
  await user.click(screen.getByRole("button", { name: "Créer le ticket" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer le ticket.");
  expect(onClose).not.toHaveBeenCalled();
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
