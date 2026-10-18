import { afterEach, expect, mock, test } from "bun:test";
import type { AgentExecution } from "@kibo/schema";
import { cleanup, render, screen } from "@testing-library/react";
import { configFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";
import { AppSettingsProvider, fixedStore } from "../state/use-app-settings";
import { fac, kib, mineSnapshots, por } from "./fixtures";

mock.module("../api", () =>
  apiMock({ client: { rpc: () => Promise.resolve([]), subscribeIntegrations: () => () => {} } }),
);
const { MyTicketsPage } = await import("./MyTicketsPage");

afterEach(cleanup);
const noop = () => undefined;

const mine = (execution: AgentExecution) =>
  render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>
      <MyTicketsPage
        viewer="adam"
        projects={[kib, por, fac]}
        snapshots={mineSnapshots}
        config={configFixture()}
        onOpenTicket={noop}
        onAssign={noop}
        onFile={noop}
      />
    </AppSettingsProvider>,
  );

test("hidden execution: Mes tickets has no Mes agents tab and no Assigner action", () => {
  mine("hidden");
  expect(screen.getByText("9 tickets · 3 projets")).toBeTruthy();
  expect(screen.queryByRole("radio", { name: "Mes agents" })).toBeNull();
  expect(screen.queryByText("Mes agents")).toBeNull();
  expect(screen.queryByRole("button", { name: "Assigner" })).toBeNull();
});

test("shown execution: the Mes agents tab and the Assigner action come back", () => {
  mine("shown");
  expect(screen.getByText("Mes agents")).toBeTruthy();
  expect(screen.getAllByRole("button", { name: "Assigner" }).length).toBeGreaterThan(0);
});
