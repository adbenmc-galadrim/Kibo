import { afterEach, expect, mock, test } from "bun:test";
import type { Question, RpcRequest } from "@kibo/schema";
import { act, cleanup, render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { siloHeldProject } from "../shell/feature/fixture";

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        Promise.resolve(
          req.method === "listProjectEvents"
            ? { items: [], nextBefore: null }
            : req.method === "listCiRuns" || req.method === "autoLinks.list"
              ? []
              : null,
        ),
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { TicketBody } = await import("./TicketBody");

afterEach(cleanup);

const question: Question = {
  kind: "question",
  images: [],
  id: "q14",
  ticketId: "e45",
  runId: null,
  title: "Quelle saisie garder ?",
  context: "",
  options: [],
  provisional: null,
  blocking: true,
  createdBy: { kind: "human", ref: "adam" },
  createdAt: new Date(2026, 9, 12, 9, 0).getTime(),
  number: 14,
  importRef: null,
  answer: null,
  recipient: "client",
  sentAt: null,
  history: [],
  archivedAt: null,
  archivedBy: null,
};

test("a blocked step on hold keeps both banners, the blocked one first, then its tracking", async () => {
  const base = siloHeldProject();
  const project = {
    ...base,
    questions: [question],
    tickets: base.tickets.map((t) => (t.id === "e45" ? { ...t, statusId: "todo" as const } : t)),
  };
  const ticket = project.tickets.find((t) => t.id === "e45");
  if (!ticket) throw new Error("fixture without SILO-45");
  render(
    <TicketBody
      project={project}
      ticket={ticket}
      viewer="adam"
      heading={(title) => <h2>{title}</h2>}
      onOpenFile={() => undefined}
      onOpenTicket={() => undefined}
    />,
  );
  await act(async () => {});
  const blocked = screen.getByRole("alert", { name: "Ticket bloqué" });
  const held = screen.getByRole("status", { name: "Étape en attente" });
  expect(held.textContent).toContain("Règle de fusion à valider par le client");
  expect(blocked.compareDocumentPosition(held) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
