import { afterEach, expect, mock, test } from "bun:test";
import { EMPTY_TABS, type RpcRequest, type Screen } from "@kibo/schema";
import { cleanup, render, waitFor } from "@testing-library/react";
import { apiMock } from "../api-mock";
import { configFixture, projectsFixture } from "../lib/fixtures";

const REPLIES: Partial<Record<RpcRequest["method"], unknown>> = {
  getTabs: EMPTY_TABS,
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

afterEach(cleanup);
const noop = () => undefined;

const screenView = (current: Screen) =>
  render(
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

const RETIRED = ["components", "sources", "domains", "sync", "security"] as const;

test("the retired screens render nothing", () => {
  for (const current of RETIRED) {
    const view = screenView(current);
    expect(view.container.innerHTML).toBe("");
    view.unmount();
  }
});

test("a tracking screen still renders", async () => {
  const view = screenView("general");
  await waitFor(() => expect(view.container.innerHTML).not.toBe(""));
});
