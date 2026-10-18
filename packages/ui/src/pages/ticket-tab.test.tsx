import { afterEach, expect, mock, test } from "bun:test";
import type { RpcRequest } from "@kibo/schema";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { emisFeatureProject } from "../shell/feature/fixture";

const LISTS: ReadonlySet<string> = new Set(["listCiRuns", "autoLinks.list"]);

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) =>
        Promise.resolve(
          req.method === "listProjectEvents"
            ? { items: [], nextBefore: null }
            : LISTS.has(req.method)
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

const { TicketTab } = await import("./TicketTab");
const { targetToHash } = await import("../tabs/target-hash");

afterEach(cleanup);

const noop = () => undefined;
const project = emisFeatureProject();
const tab = (ticketId: string) =>
  render(
    <TicketTab project={project} ticketId={ticketId} viewer="adam" onOpenFile={noop} onOpenTicket={noop} />,
  );

test("a ticket tab opened by its key shows the ticket", () => {
  tab("EMIS-33");
  expect(screen.getByRole("heading", { name: "Écran d'envoi hors ligne" })).toBeTruthy();
});

test("once shown, the ticket is addressed by its key and the address bar follows", async () => {
  history.replaceState(null, "", "#/p/emis/t/e34");
  tab("e34");
  await waitFor(() => expect(location.hash).toBe("#/p/emis/t/EMIS-34"));
  expect(targetToHash({ kind: "ticket", projectId: "emis", ticketId: "e34" })).toBe("#/p/emis/t/EMIS-34");
});

test("an unknown key says the ticket is missing", () => {
  tab("EMIS-999");
  expect(screen.getByText("Ticket introuvable")).toBeTruthy();
});
