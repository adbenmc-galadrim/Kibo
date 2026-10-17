import { afterEach, expect, mock, test } from "bun:test";
import type { AgentExecution, RpcRequest } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { kiboProject } from "../agents/fixtures";
import { apiMock } from "../api-mock";

const REPLIES: Partial<Record<RpcRequest["method"], unknown>> = {
  deliveryAgent: { ref: "global:full-delivery", name: "full-delivery" },
  "autoLinks.list": [],
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
const { AppSettingsProvider, fixedStore } = await import("../state/use-app-settings");

afterEach(cleanup);

const noop = () => undefined;

const withSetting = (execution: AgentExecution, children: ReactNode) =>
  render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>{children}</AppSettingsProvider>,
  );

const sheet = (execution: AgentExecution) =>
  withSetting(
    execution,
    <TicketSheet
      project={kiboProject()}
      ticketId="t12"
      domains={[]}
      viewer="adam"
      onClose={noop}
      onAssign={noop}
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );

const tab = (execution: AgentExecution) =>
  withSetting(
    execution,
    <TicketTab
      project={kiboProject()}
      ticketId="t12"
      viewer="adam"
      onAssign={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
    />,
  );

test("hidden execution: the ticket sheet has no assign, no Livrer, but copies /full-delivery", async () => {
  sheet("hidden");
  expect(await screen.findByRole("button", { name: "Copier /full-delivery KIB-12" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
});

test("shown execution: the ticket sheet offers assign and Livrer again", async () => {
  sheet("shown");
  expect(await screen.findByRole("button", { name: "Livrer" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Assigner à un agent" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /^Copier \/full-delivery/ })).toBeNull();
});

test("hidden execution: the Assigné field shows nobody instead of the agent profile, without its help", async () => {
  sheet("hidden");
  const field = await screen.findByRole("combobox", { name: "Assigné" });
  expect(field.textContent).toBe("Personne");
  expect(field.hasAttribute("disabled")).toBe(false);
  expect(screen.queryByText("Choisis un profil via Assigner à un agent")).toBeNull();
  expect(screen.queryByText("opus-dev")).toBeNull();
});

test("shown execution: the Assigné field names the agent profile with its help", async () => {
  sheet("shown");
  const field = await screen.findByRole("combobox", { name: "Assigné" });
  expect(field.textContent).toBe("opus-dev");
  expect(screen.getByText("Choisis un profil via Assigner à un agent")).toBeTruthy();
});

test("hidden execution: the ticket tab has no assign action", async () => {
  tab("hidden");
  expect(await screen.findByRole("combobox", { name: "Assigné" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
});

test("shown execution: the ticket tab offers assign again", async () => {
  tab("shown");
  expect(await screen.findByRole("button", { name: "Assigner à un agent" })).toBeTruthy();
});
