import { afterEach, expect, mock, test } from "bun:test";
import { EMPTY_TABS, type RpcRequest } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { kiboProject } from "../lib/fixtures";

const REPLIES: Partial<Record<RpcRequest["method"], unknown>> = {
  getTabs: EMPTY_TABS,
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: (req: RpcRequest) => Promise.resolve(REPLIES[req.method] ?? null),
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeIntegrations: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { TicketSheet } = await import("./TicketSheet");
const { TicketTab } = await import("../pages/TicketTab");

afterEach(cleanup);

const noop = () => undefined;

const sheet = () =>
  render(
    <TicketSheet
      project={kiboProject()}
      ticketId="t12"
      domains={[]}
      viewer="adam"
      onClose={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );

const tab = () =>
  render(
    <TicketTab project={kiboProject()} ticketId="t12" viewer="adam" onOpenFile={noop} onOpenTicket={noop} />,
  );

test("the ticket sheet has no assign, no Livrer, but copies /full-delivery", async () => {
  sheet();
  expect(await screen.findByRole("button", { name: "Copier /full-delivery KIB-12" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
});

test("the Assigné field never names an agent profile", async () => {
  sheet();
  const field = await screen.findByRole("combobox", { name: "Assigné" });
  expect(field.textContent).toBe("Personne");
  expect(field.hasAttribute("disabled")).toBe(false);
  expect(screen.queryByText("Choisis un profil via Assigner à un agent")).toBeNull();
  expect(screen.queryByText("opus-dev")).toBeNull();
});

test("the ticket tab has no assign action", async () => {
  tab();
  expect(await screen.findByRole("combobox", { name: "Assigné" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
});
