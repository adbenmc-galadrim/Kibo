import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import {
  type AgentsState,
  KiboError,
  type ProjectSnapshot,
  type RpcRequest,
  type TicketView,
} from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { agentsFixture, kiboProject, runFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { AgentsProvider } from "../state/agents-context";

const calls: RpcRequest[] = [];
let deliver: () => Promise<unknown> = () => Promise.resolve(runFixture({ id: "r9" }));
const FULL_DELIVERY = { ref: "global:full-delivery", name: "full-delivery" };
let agent: () => Promise<unknown> = () => Promise.resolve(FULL_DELIVERY);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => {
        calls.push(req);
        return req.method === "deliveryAgent" ? agent() : deliver();
      },
      subscribeTopic: () => () => {},
    },
  }),
);

const { DeliverButton } = await import("./DeliverButton");

beforeEach(() => {
  calls.length = 0;
  deliver = () => Promise.resolve(runFixture({ id: "r9" }));
  agent = () => Promise.resolve(FULL_DELIVERY);
});
afterEach(cleanup);

const ticketOf = (project: ProjectSnapshot, id: string): TicketView => {
  const t = project.tickets.find((x) => x.id === id);
  if (!t) throw new Error(`no ticket ${id}`);
  return t;
};

const show = (project = kiboProject(), id = "t14", state: AgentsState | null = null) =>
  render(
    <AgentsProvider agents={state}>
      <DeliverButton project={project} ticket={ticketOf(project, id)} />
    </AgentsProvider>,
  );

test("Livrer sends deliver for the ticket", async () => {
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Livrer" }));
  await waitFor(() => expect(calls.some((c) => c.method === "deliver")).toBe(true));
  expect(calls.find((c) => c.method === "deliver")).toEqual({
    method: "deliver",
    projectId: "kibo",
    ticketId: "t14",
  });
});

test("an active run disables Livrer and names it", async () => {
  const state = agentsFixture();
  const run = runFixture({
    id: "r1",
    ticketId: "t14",
    state: "running",
    label: "emis · full-delivery · EMIS-15",
  });
  show(kiboProject(), "t14", { ...state, runs: [run] });
  const button = await screen.findByRole("button", { name: "Livrer" });
  expect(button.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("déjà un run : emis · full-delivery · EMIS-15")).toBeTruthy();
});

test("the delivery agent of the project is asked once", async () => {
  show();
  await screen.findByRole("button", { name: "Livrer" });
  expect(calls.filter((c) => c.method === "deliveryAgent")).toEqual([
    { method: "deliveryAgent", projectId: "kibo" },
  ]);
});

test("no delivery agent, a failure or an odd answer keeps Livrer away", async () => {
  for (const answer of [
    () => Promise.resolve(null),
    () => Promise.reject(new Error("down")),
    () => Promise.resolve(undefined),
  ]) {
    agent = answer;
    calls.length = 0;
    show();
    await waitFor(() => expect(calls.some((c) => c.method === "deliveryAgent")).toBe(true));
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
    cleanup();
  }
});

test("Livrer is absent for a reader or on a done ticket", () => {
  const reader = kiboProject();
  show({ ...reader, sync: { ...reader.sync, access: "read-only" } });
  expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
  cleanup();
  show(kiboProject(), "t5");
  expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
});

test("a parent answer opens the sub-tickets dialog instead of a run", async () => {
  const project = kiboProject();
  const child = { ...ticketOf(project, "t15"), id: "c1", key: "KIB-31", keyLabel: "KIB-31", parentId: "t14" };
  const withChild = { ...project, tickets: [...project.tickets, child] };
  deliver = () =>
    Promise.resolve({
      kind: "parent",
      items: [
        { ticketId: "c1", key: "KIB-31", title: child.title, ready: true, reason: null, blockedBy: [] },
      ],
    });
  show(withChild);
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Livrer" }));
  expect(await screen.findByRole("dialog", { name: "Livrer les sous-tickets de KIB-14" })).toBeTruthy();
  expect(screen.getByRole("checkbox", { name: `KIB-31 ${child.title}` }).getAttribute("aria-checked")).toBe(
    "true",
  );
});

test("a refused deliver says why", async () => {
  deliver = () => Promise.reject(new KiboError("AGENT_NOT_FOUND", "no agent"));
  show();
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", { name: "Livrer" }));
  expect((await screen.findByRole("alert")).textContent).toBe(
    "Échec de la livraison de KIB-14 : Choisis l'agent qui livre, ou applique le préréglage Livraison à un agent.",
  );
});
