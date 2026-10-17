import { afterEach, expect, mock, test } from "bun:test";
import { type AgentExecution, EMPTY_TABS, type RpcRequest, type Screen } from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { agentsFixture, configFixture, NOW, projectsFixture } from "../agents/fixtures";
import { apiMock } from "../api-mock";

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
      agents={agentsFixture()}
      config={configFixture()}
      now={NOW}
      onAnswer={noop}
      onOpenRun={noop}
      onOpenTicket={noop}
      onAssign={noop}
      onFile={noop}
      onOpen={noop}
      onShare={noop}
      onDeleteProject={noop}
      onNewTicket={noop}
    />,
  );

test("hidden execution: the Agents and Files d'attente screens render nothing under the notice", () => {
  for (const current of ["agents", "queue", "skills"] as const) {
    const view = screenView("hidden", current);
    expect(view.container.innerHTML).toBe("");
    view.unmount();
  }
});

test("shown execution: the Agents screen renders again", async () => {
  const view = screenView("shown", "agents");
  await waitFor(() => expect(view.container.innerHTML).not.toBe(""));
});
