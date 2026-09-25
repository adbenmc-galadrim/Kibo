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

const { AddComponentDialog } = await import("./AddComponentDialog");
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
};
const page = { id: "pg1", title: "Vue", kind: "view", parentId: null } as const;

beforeEach(() => {
  calls.length = 0;
  outcome = () => Promise.resolve(null);
});

test("AddComponentDialog adds the selected component then closes", async () => {
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: { method: "addInstance", pageId: "pg1", component: "kanban@1.0.0" },
    },
  ]);
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("AddComponentDialog places a dashboard widget in the next free slot", async () => {
  const dashboard = { ...page, kind: "dashboard" } as const;
  const taken = [{ x: 0, y: 0, w: 6, h: 6 }];
  render(<AddComponentDialog projectId="p1" page={dashboard} taken={taken} open onOpenChange={() => {}} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect(calls).toEqual([
    {
      method: "command",
      projectId: "p1",
      command: {
        method: "addInstance",
        pageId: "pg1",
        component: "kanban@1.0.0",
        layout: { x: 6, y: 0, w: 6, h: 6 },
      },
    },
  ]);
});

test("AddComponentDialog shows an alert and stays open when the RPC fails", async () => {
  outcome = fail;
  const onOpenChange = mock((_: boolean) => {});
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Tickets" }));
  await user.click(screen.getByRole("button", { name: "Ajouter" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ajouter le composant.");
  expect(onOpenChange).not.toHaveBeenCalled();
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
  render(<NewPageDialog projectId="p1" parentId={null} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "Tableau");
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer la page.");
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("NewPageDialog shows an alert when the daemon returns an invalid page", async () => {
  outcome = () => Promise.resolve({ id: "x" });
  const onOpenChange = mock((_: boolean) => {});
  render(<NewPageDialog projectId="p1" parentId={null} open onOpenChange={onOpenChange} />);
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Titre"), "Tableau");
  await user.click(screen.getByRole("button", { name: "Créer la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible de créer la page.");
  expect(onOpenChange).not.toHaveBeenCalled();
});
