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
  rules: [],
  nextTicketKey: "KIB-1",
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
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
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
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
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
  await user.click(screen.getByRole("button", { name: "Ajouter à la page" }));
  expect((await screen.findByRole("alert")).textContent).toBe("Impossible d'ajouter le composant.");
  expect(onOpenChange).not.toHaveBeenCalled();
});

test("AddComponentDialog describes each component and its permissions", async () => {
  render(<AddComponentDialog projectId="p1" page={page} taken={[]} open onOpenChange={() => {}} />);
  expect(screen.getByText("Choisis un composant pour voir ce qu'il lit et modifie.")).toBeTruthy();
  const user = userEvent.setup();
  await user.click(screen.getByRole("radio", { name: "Kanban" }));
  expect(screen.getByText("Lit : ticket, status, run")).toBeTruthy();
  expect(screen.getAllByText("Tickets par statut, glisser-déposer")).toHaveLength(2);
  expect(screen.getByText("Arbre des tickets, sous-tickets illimités")).toBeTruthy();
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
