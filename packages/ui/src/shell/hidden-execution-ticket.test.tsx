import { afterEach, expect, mock, test } from "bun:test";
import { type AgentExecution, EMPTY_TABS, type RpcRequest } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { apiMock } from "../api-mock";
import { kiboProject } from "../lib/fixtures";

const REPLIES: Partial<Record<RpcRequest["method"], unknown>> = {
  deliveryAgent: { ref: "global:full-delivery", name: "full-delivery" },
  "autoLinks.list": [],
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
      onOpenInTab={noop}
      onOpenFile={noop}
      onOpenTicket={noop}
      onDeleted={noop}
    />,
  );

const tab = (execution: AgentExecution) =>
  withSetting(
    execution,
    <TicketTab project={kiboProject()} ticketId="t12" viewer="adam" onOpenFile={noop} onOpenTicket={noop} />,
  );

for (const execution of ["hidden", "shown"] as const) {
  test(`${execution} execution: the ticket sheet has no assign, no Livrer, but copies /full-delivery`, async () => {
    sheet(execution);
    expect(await screen.findByRole("button", { name: "Copier /full-delivery KIB-12" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Livrer" })).toBeNull();
  });

  test(`${execution} execution: the Assigné field never names an agent profile`, async () => {
    sheet(execution);
    const field = await screen.findByRole("combobox", { name: "Assigné" });
    expect(field.textContent).toBe("Personne");
    expect(field.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText("Choisis un profil via Assigner à un agent")).toBeNull();
    expect(screen.queryByText("opus-dev")).toBeNull();
  });

  test(`${execution} execution: the ticket tab has no assign action`, async () => {
    tab(execution);
    expect(await screen.findByRole("combobox", { name: "Assigné" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Assigner à un agent" })).toBeNull();
  });
}
