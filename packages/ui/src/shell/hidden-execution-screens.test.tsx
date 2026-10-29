import { afterEach, expect, mock, test } from "bun:test";
import { type AgentExecution, EMPTY_TABS, type RpcRequest, type Screen } from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { apiMock } from "../api-mock";
import { configFixture, projectsFixture } from "../lib/fixtures";

const REPLIES: Partial<Record<RpcRequest["method"], unknown>> = {
  getTabs: EMPTY_TABS,
  "agents.list": { agents: [], partialWatch: false, notices: [] },
};

mock.module("../api", () =>
  apiMock({
    client: {
      rpc: async (req: RpcRequest) => REPLIES[req.method] ?? null,
      subscribe: () => () => undefined,
      subscribeTopic: () => () => undefined,
      subscribeEvents: () => () => undefined,
    },
  }),
);

const { ScreenView } = await import("./ScreenView");
const { AppSettingsProvider, fixedStore } = await import("../state/use-app-settings");

afterEach(cleanup);
const noop = () => undefined;

const withSetting = (execution: AgentExecution, children: ReactNode) =>
  render(
    <AppSettingsProvider store={fixedStore({ agentExecution: execution })}>{children}</AppSettingsProvider>,
  );

const screenView = (execution: AgentExecution, current: Screen) =>
  withSetting(
    execution,
    <ScreenView
      screen={current}
      viewer="adam"
      projects={projectsFixture}
      snapshots={new Map()}
      config={configFixture()}
      onOpenTicket={noop}
      onFile={noop}
      onNewTicket={noop}
    />,
  );

const RETIRED = [
  "agents",
  "queue",
  "skills",
  "creations",
  "components",
  "sources",
  "domains",
  "sync",
  "security",
] as const;

test("the agent-era screens render nothing, whatever the setting", () => {
  for (const execution of ["hidden", "shown"] as const)
    for (const current of RETIRED) {
      const view = screenView(execution, current);
      expect(view.container.innerHTML).toBe("");
      view.unmount();
    }
});

test("a tracking screen still renders", async () => {
  const view = screenView("hidden", "general");
  await waitFor(() => expect(view.container.innerHTML).not.toBe(""));
});
